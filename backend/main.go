package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/lib/pq"
	_ "github.com/lib/pq"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB
var jwtSecret []byte

// ---------- Models (✅ created_at returned as ISO string with timezone) ----------
type Topic struct {
	ID              int    `json:"id"`
	Title           string `json:"title"`
	Content         string `json:"content"`
	UserID          int    `json:"user_id"`
	AuthorName      string `json:"author_name"`
	AuthorAvatarURL string `json:"author_avatar_url"`
	CreatedAt       string `json:"created_at"` // ✅ ISO string, e.g. 2025-12-22T14:57:10Z
	ReplyCount      int    `json:"reply_count"`
}

type Reply struct {
	ID              int    `json:"id"`
	TopicID         int    `json:"topic_id"`
	Content         string `json:"content"`
	UserID          int    `json:"user_id"`
	AuthorName      string `json:"author_name"`
	AuthorAvatarURL string `json:"author_avatar_url"`
	CreatedAt       string `json:"created_at"` // ✅ ISO string
}

type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"name"` // frontend sends "name"
	Email     string    `json:"email"`
	AvatarURL string    `json:"avatar_url"`
	Password  string    `json:"password"` // input only
	CreatedAt time.Time `json:"created_at"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// ---------- Auth helpers ----------
type ctxKey string

const ctxUserID ctxKey = "userID"

type tokenPayload struct {
	UserID int   `json:"uid"`
	Exp    int64 `json:"exp"`
}

func sign(data string) string {
	mac := hmac.New(sha256.New, jwtSecret)
	mac.Write([]byte(data))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func makeToken(userID int) (string, error) {
	pl := tokenPayload{
		UserID: userID,
		Exp:    time.Now().Add(24 * time.Hour).Unix(),
	}
	b, err := json.Marshal(pl)
	if err != nil {
		return "", err
	}
	p := base64.RawURLEncoding.EncodeToString(b)
	return p + "." + sign(p), nil
}

func parseToken(tok string) (int, error) {
	parts := strings.Split(tok, ".")
	if len(parts) != 2 {
		return 0, fmt.Errorf("bad token")
	}
	p, sig := parts[0], parts[1]

	if !hmac.Equal([]byte(sign(p)), []byte(sig)) {
		return 0, fmt.Errorf("bad signature")
	}

	pb, err := base64.RawURLEncoding.DecodeString(p)
	if err != nil {
		return 0, fmt.Errorf("bad payload")
	}

	var pl tokenPayload
	if err := json.Unmarshal(pb, &pl); err != nil {
		return 0, fmt.Errorf("bad payload json")
	}
	if time.Now().Unix() > pl.Exp {
		return 0, fmt.Errorf("expired")
	}
	return pl.UserID, nil
}

func requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		tok := strings.TrimPrefix(auth, "Bearer ")
		uid, err := parseToken(tok)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ctxUserID, uid)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func getUserID(r *http.Request) int {
	v := r.Context().Value(ctxUserID)
	if v == nil {
		return 0
	}
	return v.(int)
}

// ---------- main ----------
func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found (using system env vars)")
	}

	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("JWT_SECRET is not set")
	}
	jwtSecret = []byte(secret)

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}
	if err = db.Ping(); err != nil {
		log.Fatal("DB connection failed:", err)
	}

	mux := http.NewServeMux()

	// Auth
	mux.Handle("/register", http.HandlerFunc(signupHandler))
	mux.Handle("/login", http.HandlerFunc(loginHandler))

	// Replies (GET public, POST auth)
	mux.Handle("/replies", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			repliesHandler(w, r)
			return
		}
		requireAuth(http.HandlerFunc(repliesHandler)).ServeHTTP(w, r)
	}))
	mux.Handle("/replies/", requireAuth(http.HandlerFunc(replyByIDHandler)))

	// Topics (GET public, POST auth)
	mux.Handle("/topics", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			topicsHandler(w, r)
			return
		}
		requireAuth(http.HandlerFunc(topicsHandler)).ServeHTTP(w, r)
	}))
	mux.Handle("/topics/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			topicByIDHandler(w, r)
			return
		}
		requireAuth(http.HandlerFunc(topicByIDHandler)).ServeHTTP(w, r)
	}))

	mux.Handle("/search", http.HandlerFunc(searchHandler))

	// uploads + avatar
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))
	mux.Handle("/me/avatar", requireAuth(http.HandlerFunc(uploadAvatarHandler)))

	mux.HandleFunc("/debug-origin", func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowed := os.Getenv("FRONTEND_ORIGIN")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"origin_raw":      origin,
			"origin_trimmed":  strings.TrimRight(origin, "/"),
			"allowed_raw":     allowed,
			"allowed_trimmed": strings.TrimRight(allowed, "/"),
			"method":          r.Method,
		})
	})

	handler := cors(mux)

	log.Println("🚀 API running at http://localhost:5000")
	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

// ---------- CORS ----------
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimRight(r.Header.Get("Origin"), "/")

		allowed1 := strings.TrimRight(os.Getenv("FRONTEND_ORIGIN"), "/")
		allowed2 := strings.TrimRight(os.Getenv("FRONTEND_ORIGIN_2"), "/")

		isAllowed := origin != "" && (origin == allowed1 || (allowed2 != "" && origin == allowed2))

		if origin != "" && isAllowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}

		if r.Method == http.MethodOptions {
			if !isAllowed {
				http.Error(w, "CORS blocked for origin: "+origin, http.StatusForbidden)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}

		if origin != "" && !isAllowed {
			http.Error(w, "CORS blocked for origin: "+origin, http.StatusForbidden)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		next.ServeHTTP(w, r)
	})
}

// ---------- /topics ----------
func topicsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(`
			SELECT
				t.id,
				t.title,
				t.content,
				t.user_id,
				u.username,
				COALESCE(u.avatar_url, '') AS avatar_url,
				to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
				COUNT(r.id) AS reply_count
			FROM topics t
			JOIN users u ON u.id = t.user_id
			LEFT JOIN replies r ON r.topic_id = t.id
			GROUP BY
				t.id, t.title, t.content, t.user_id, u.username, u.avatar_url, t.created_at
			ORDER BY t.created_at DESC
		`)
		if err != nil {
			log.Println("TOPICS GET ERROR:", err)
			http.Error(w, err.Error(), 500)
			return
		}
		defer rows.Close()

		var topics []Topic
		for rows.Next() {
			var t Topic
			if err := rows.Scan(
				&t.ID,
				&t.Title,
				&t.Content,
				&t.UserID,
				&t.AuthorName,
				&t.AuthorAvatarURL,
				&t.CreatedAt,
				&t.ReplyCount,
			); err != nil {
				log.Println("TOPICS SCAN ERROR:", err)
				http.Error(w, err.Error(), 500)
				return
			}
			topics = append(topics, t)
		}
		_ = json.NewEncoder(w).Encode(topics)

	case http.MethodPost:
		uid := getUserID(r)
		if uid == 0 {
			http.Error(w, "Unauthorized", 401)
			return
		}

		var payload struct {
			Title   string `json:"title"`
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		if strings.TrimSpace(payload.Title) == "" || strings.TrimSpace(payload.Content) == "" {
			http.Error(w, "title and content required", 400)
			return
		}

		var topicID int
		if err := db.QueryRow(`
			INSERT INTO topics (title, content, user_id, created_at)
			VALUES ($1, $2, $3, NOW())
			RETURNING id
		`, payload.Title, payload.Content, uid).Scan(&topicID); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		// Return fully formatted record (with avatar_url + ISO created_at)
		var t Topic
		if err := db.QueryRow(`
			SELECT
				t.id,
				t.title,
				t.content,
				t.user_id,
				u.username,
				COALESCE(u.avatar_url, '') AS avatar_url,
				to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
				0 AS reply_count
			FROM topics t
			JOIN users u ON u.id = t.user_id
			WHERE t.id=$1
		`, topicID).Scan(
			&t.ID,
			&t.Title,
			&t.Content,
			&t.UserID,
			&t.AuthorName,
			&t.AuthorAvatarURL,
			&t.CreatedAt,
			&t.ReplyCount,
		); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		_ = json.NewEncoder(w).Encode(t)

	default:
		http.Error(w, "Method not allowed", 405)
	}
}

// ---------- /topics/{id} ----------
func topicByIDHandler(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/topics/"), "/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid ID", 400)
		return
	}

	switch r.Method {
	case http.MethodGet:
		var t Topic
		// include avatar_url + ISO created_at
		row := db.QueryRow(`
			SELECT
				t.id, t.title, t.content, t.user_id,
				u.username, COALESCE(u.avatar_url, '') AS avatar_url,
				to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
				(SELECT COUNT(*) FROM replies r WHERE r.topic_id=t.id) AS reply_count
			FROM topics t
			JOIN users u ON u.id = t.user_id
			WHERE t.id=$1
		`, id)

		if err := row.Scan(
			&t.ID, &t.Title, &t.Content, &t.UserID,
			&t.AuthorName, &t.AuthorAvatarURL,
			&t.CreatedAt, &t.ReplyCount,
		); err != nil {
			http.Error(w, "Topic not found", 404)
			return
		}
		_ = json.NewEncoder(w).Encode(t)

	case http.MethodPut:
		uid := getUserID(r)
		if uid == 0 {
			http.Error(w, "Unauthorized", 401)
			return
		}

		var payload struct {
			Title   string `json:"title"`
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}

		var ownerID int
		if err := db.QueryRow(`SELECT user_id FROM topics WHERE id=$1`, id).Scan(&ownerID); err != nil {
			http.Error(w, "Topic not found", 404)
			return
		}
		if uid != ownerID {
			http.Error(w, "Forbidden", 403)
			return
		}

		if _, err := db.Exec(`UPDATE topics SET title=$1, content=$2 WHERE id=$3`, payload.Title, payload.Content, id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		// return updated record
		var t Topic
		if err := db.QueryRow(`
			SELECT
				t.id, t.title, t.content, t.user_id,
				u.username, COALESCE(u.avatar_url, '') AS avatar_url,
				to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
				(SELECT COUNT(*) FROM replies r WHERE r.topic_id=t.id) AS reply_count
			FROM topics t
			JOIN users u ON u.id = t.user_id
			WHERE t.id=$1
		`, id).Scan(
			&t.ID, &t.Title, &t.Content, &t.UserID,
			&t.AuthorName, &t.AuthorAvatarURL,
			&t.CreatedAt, &t.ReplyCount,
		); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		_ = json.NewEncoder(w).Encode(t)

	case http.MethodDelete:
		uid := getUserID(r)
		if uid == 0 {
			http.Error(w, "Unauthorized", 401)
			return
		}

		var ownerID int
		if err := db.QueryRow(`SELECT user_id FROM topics WHERE id=$1`, id).Scan(&ownerID); err != nil {
			http.Error(w, "Topic not found", 404)
			return
		}
		if uid != ownerID {
			http.Error(w, "Forbidden", 403)
			return
		}

		_, _ = db.Exec(`DELETE FROM topics WHERE id=$1`, id)
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "Method not allowed", 405)
	}
}

// ---------- /replies ----------
func repliesHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		topicIDStr := r.URL.Query().Get("topic_id")
		topicID, err := strconv.Atoi(topicIDStr)
		if err != nil {
			http.Error(w, "Invalid topic_id", 400)
			return
		}

		rows, err := db.Query(`
			SELECT
				r.id,
				r.topic_id,
				r.content,
				r.user_id,
				u.username,
				COALESCE(u.avatar_url, '') AS avatar_url,
				to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
			FROM replies r
			JOIN users u ON u.id = r.user_id
			WHERE r.topic_id=$1
			ORDER BY r.created_at ASC
		`, topicID)
		if err != nil {
			log.Println("REPLIES GET ERROR:", err)
			http.Error(w, err.Error(), 500)
			return
		}
		defer rows.Close()

		var replies []Reply
		for rows.Next() {
			var rp Reply
			if err := rows.Scan(
				&rp.ID,
				&rp.TopicID,
				&rp.Content,
				&rp.UserID,
				&rp.AuthorName,
				&rp.AuthorAvatarURL,
				&rp.CreatedAt,
			); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			replies = append(replies, rp)
		}

		_ = json.NewEncoder(w).Encode(replies)

	case http.MethodPost:
		uid := getUserID(r)
		if uid == 0 {
			http.Error(w, "Unauthorized", 401)
			return
		}

		var payload struct {
			TopicID int    `json:"topic_id"`
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		if payload.TopicID == 0 || strings.TrimSpace(payload.Content) == "" {
			http.Error(w, "topic_id and content required", 400)
			return
		}

		var replyID int
		if err := db.QueryRow(`
			INSERT INTO replies (topic_id, content, user_id, created_at)
			VALUES ($1, $2, $3, NOW())
			RETURNING id
		`, payload.TopicID, payload.Content, uid).Scan(&replyID); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		// Return fully formatted record (with avatar_url + ISO created_at)
		var rp Reply
		if err := db.QueryRow(`
			SELECT
				r.id,
				r.topic_id,
				r.content,
				r.user_id,
				u.username,
				COALESCE(u.avatar_url, '') AS avatar_url,
				to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
			FROM replies r
			JOIN users u ON u.id = r.user_id
			WHERE r.id=$1
		`, replyID).Scan(
			&rp.ID,
			&rp.TopicID,
			&rp.Content,
			&rp.UserID,
			&rp.AuthorName,
			&rp.AuthorAvatarURL,
			&rp.CreatedAt,
		); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		_ = json.NewEncoder(w).Encode(rp)

	default:
		http.Error(w, "Method not allowed", 405)
	}
}

// ---------- /replies/{id} ----------
func replyByIDHandler(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/replies/"), "/")
	replyID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid ID", 400)
		return
	}

	uid := getUserID(r)
	if uid == 0 {
		http.Error(w, "Unauthorized", 401)
		return
	}

	switch r.Method {
	case http.MethodPut:
		var payload struct {
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		if strings.TrimSpace(payload.Content) == "" {
			http.Error(w, "content required", 400)
			return
		}

		var ownerID int
		if err := db.QueryRow(`SELECT user_id FROM replies WHERE id=$1`, replyID).Scan(&ownerID); err != nil {
			http.Error(w, "Reply not found", 404)
			return
		}
		if uid != ownerID {
			http.Error(w, "Forbidden", 403)
			return
		}

		if _, err := db.Exec(`UPDATE replies SET content=$1 WHERE id=$2`, payload.Content, replyID); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":      replyID,
			"content": payload.Content,
		})

	case http.MethodDelete:
		var ownerID int
		if err := db.QueryRow(`SELECT user_id FROM replies WHERE id=$1`, replyID).Scan(&ownerID); err != nil {
			http.Error(w, "Reply not found", 404)
			return
		}
		if uid != ownerID {
			http.Error(w, "Forbidden", 403)
			return
		}

		if _, err := db.Exec(`DELETE FROM replies WHERE id=$1`, replyID); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "Method not allowed", 405)
	}
}

// ---------- /register ----------
func signupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", 405)
		return
	}

	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "Invalid JSON", 400)
		return
	}

	if user.Username == "" || user.Email == "" || user.Password == "" {
		http.Error(w, "All fields are required", 400)
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", 500)
		return
	}

	err = db.QueryRow(
		`INSERT INTO users (username, email, password_hash)
		 VALUES ($1, $2, $3)
		 RETURNING id, created_at`,
		user.Username, user.Email, string(hashed),
	).Scan(&user.ID, &user.CreatedAt)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok {
			if pqErr.Constraint == "users_username_key" {
				http.Error(w, "Username already exists", http.StatusConflict)
				return
			}
			if pqErr.Constraint == "users_email_key" {
				http.Error(w, "Email already exists", http.StatusConflict)
				return
			}
		}
		log.Println("REGISTER DB ERROR:", err)
		http.Error(w, "Failed to create account", http.StatusInternalServerError)
		return
	}

	user.Password = ""
	_ = json.NewEncoder(w).Encode(user)
}

// ---------- /login ----------
func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", 405)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", 400)
		return
	}
	if req.Email == "" || req.Password == "" {
		http.Error(w, "Email and password required", 400)
		return
	}

	var user User
	var hash string
	err := db.QueryRow(
		`SELECT id, username, email, COALESCE(avatar_url, ''), password_hash, created_at
		 FROM users WHERE email=$1`,
		req.Email,
	).Scan(&user.ID, &user.Username, &user.Email, &user.AvatarURL, &hash, &user.CreatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "Invalid email or password", 401)
		return
	}
	if err != nil {
		log.Println("LOGIN ERROR:", err)
		http.Error(w, "Internal server error", 500)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid email or password", 401)
		return
	}

	token, err := makeToken(user.ID)
	if err != nil {
		http.Error(w, "Internal server error", 500)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"user":  user,
		"token": token,
	})
}

func searchHandler(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		_ = json.NewEncoder(w).Encode([]Topic{})
		return
	}

	rows, err := db.Query(`
		SELECT
			t.id, t.title, t.content, t.user_id,
			u.username,
			COALESCE(u.avatar_url, '') AS avatar_url,
			to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
		FROM topics t
		JOIN users u ON u.id = t.user_id
		WHERE
			t.title ILIKE '%' || $1 || '%' OR
			t.content ILIKE '%' || $1 || '%' OR
			u.username ILIKE '%' || $1 || '%'
		ORDER BY t.created_at DESC
	`, q)
	if err != nil {
		log.Println("SEARCH ERROR:", err)
		http.Error(w, "Search failed", 500)
		return
	}
	defer rows.Close()

	var results []Topic
	for rows.Next() {
		var t Topic
		if err := rows.Scan(
			&t.ID,
			&t.Title,
			&t.Content,
			&t.UserID,
			&t.AuthorName,
			&t.AuthorAvatarURL,
			&t.CreatedAt,
		); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		results = append(results, t)
	}

	_ = json.NewEncoder(w).Encode(results)
}

// ---------- /me/avatar ----------
func uploadAvatarHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", 405)
		return
	}

	uid := getUserID(r)
	if uid == 0 {
		http.Error(w, "Unauthorized", 401)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 5<<20)

	if err := r.ParseMultipartForm(5 << 20); err != nil {
		http.Error(w, "File too large / invalid form", 400)
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		http.Error(w, "Missing file field: avatar", 400)
		return
	}
	defer file.Close()

	ct := header.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		http.Error(w, "Only image uploads are allowed", 400)
		return
	}

	if err := os.MkdirAll("./uploads", 0755); err != nil {
		http.Error(w, "Failed to create uploads dir", 500)
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" || len(ext) > 10 {
		ext = ".png"
	}

	filename := fmt.Sprintf("u%d_%d%s", uid, time.Now().UnixNano(), ext)
	dstPath := filepath.Join("./uploads", filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		http.Error(w, "Failed to save file", 500)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Failed to write file", 500)
		return
	}

	avatarURL := "/uploads/" + filename

	if _, err := db.Exec(`UPDATE users SET avatar_url=$1 WHERE id=$2`, avatarURL, uid); err != nil {
		http.Error(w, "Failed to update avatar_url", 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"avatar_url": avatarURL,
	})
}
