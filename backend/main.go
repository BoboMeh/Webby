package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
	"os"

	"golang.org/x/crypto/bcrypt"
	_ "github.com/lib/pq"
	"github.com/joho/godotenv"
)

var db *sql.DB

// TODO: Move to env var
// var jwtSecret = []byte("CHANGE_ME_TO_SOMETHING_RANDOM_AND_LONG")
var jwtSecret []byte


// ---------- Models ----------
type Topic struct {
	ID         int       `json:"id"`
	Title      string    `json:"title"`
	Content    string    `json:"content"`
	UserID     int       `json:"user_id"`
	AuthorName string    `json:"author_name"`
	CreatedAt  time.Time `json:"created_at"`
}

type Reply struct {
	ID         int       `json:"id"`
	TopicID    int       `json:"topic_id"`
	Content    string    `json:"content"`
	UserID     int       `json:"user_id"`
	AuthorName string    `json:"author_name"`
	CreatedAt  time.Time `json:"created_at"`
}

type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"name"`     // frontend sends "name"
	Email     string    `json:"email"`
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
		Exp:    time.Now().Add(24 * time.Hour).Unix(), // token lifetime
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
	// ✅ Load .env first (local dev)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found (using system env vars)")
	}

	// ✅ Now read env vars
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

	// Public auth routes
	mux.Handle("/register", http.HandlerFunc(signupHandler))
	mux.Handle("/login", http.HandlerFunc(loginHandler))

	// Replies
	// GET /replies is public, POST /replies requires auth
	mux.Handle("/replies", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			repliesHandler(w, r)
			return
		}
		requireAuth(http.HandlerFunc(repliesHandler)).ServeHTTP(w, r)
	}))
	// PUT/DELETE /replies/{id} require auth
	mux.Handle("/replies/", requireAuth(http.HandlerFunc(replyByIDHandler)))

	// Topics
	// GET /topics is public, POST /topics requires auth
	mux.Handle("/topics", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			topicsHandler(w, r)
			return
		}
		requireAuth(http.HandlerFunc(topicsHandler)).ServeHTTP(w, r)
	}))

	// GET /topics/{id} public, PUT/DELETE require auth
	mux.Handle("/topics/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			topicByIDHandler(w, r)
			return
		}
		requireAuth(http.HandlerFunc(topicByIDHandler)).ServeHTTP(w, r)
	}))

	handler := cors(mux)

	log.Println("🚀 API running at http://localhost:5000")
	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}
	log.Fatal(http.ListenAndServe(":"+port, handler))

	}

// ---------- CORS ----------
// func cors(next http.Handler) http.Handler {
// 	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
// 		origin := r.Header.Get("Origin")
// 		if origin == "" {
// 			next.ServeHTTP(w, r)
// 			return
// 		}

// 		allowed := os.Getenv("FRONTEND_ORIGIN") // e.g. https://your-frontend.vercel.app
// 		if allowed != "" && origin == allowed {
// 			w.Header().Set("Access-Control-Allow-Origin", origin)
// 			w.Header().Set("Vary", "Origin")
// 		}


// 		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
// 		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

// 		if r.Method == http.MethodOptions {
// 			w.WriteHeader(http.StatusOK)
// 			return
// 		}

// 		w.Header().Set("Content-Type", "application/json")
// 		next.ServeHTTP(w, r)
// 	})
// }

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimRight(r.Header.Get("Origin"), "/")

		allowed1 := strings.TrimRight(os.Getenv("FRONTEND_ORIGIN"), "/")
		allowed2 := strings.TrimRight(os.Getenv("FRONTEND_ORIGIN_2"), "/") // optional

		isAllowed := origin != "" && (origin == allowed1 || (allowed2 != "" && origin == allowed2))

		if origin != "" && isAllowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}

		// Preflight
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
			SELECT t.id, t.title, t.content, t.user_id, u.username, t.created_at
			FROM topics t
			JOIN users u ON u.id = t.user_id
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
			if err := rows.Scan(&t.ID, &t.Title, &t.Content, &t.UserID, &t.AuthorName, &t.CreatedAt); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			topics = append(topics, t)
		}
		json.NewEncoder(w).Encode(topics)

	case http.MethodPost:
		uid := getUserID(r)
		if uid == 0 {
			http.Error(w, "Unauthorized", 401)
			return
		}

		var t Topic
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		if strings.TrimSpace(t.Title) == "" || strings.TrimSpace(t.Content) == "" {
			http.Error(w, "title and content required", 400)
			return
		}

		err := db.QueryRow(`
			INSERT INTO topics (title, content, user_id, created_at)
			VALUES ($1, $2, $3, NOW())
			RETURNING id, user_id, created_at
		`, t.Title, t.Content, uid).Scan(&t.ID, &t.UserID, &t.CreatedAt)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		_ = db.QueryRow(`SELECT username FROM users WHERE id=$1`, t.UserID).Scan(&t.AuthorName)

		json.NewEncoder(w).Encode(t)

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
		row := db.QueryRow(`
			SELECT t.id, t.title, t.content, t.user_id, u.username, t.created_at
			FROM topics t
			JOIN users u ON u.id = t.user_id
			WHERE t.id=$1
		`, id)
		if err := row.Scan(&t.ID, &t.Title, &t.Content, &t.UserID, &t.AuthorName, &t.CreatedAt); err != nil {
			http.Error(w, "Topic not found", 404)
			return
		}
		json.NewEncoder(w).Encode(t)

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

		_, err := db.Exec(`UPDATE topics SET title=$1, content=$2 WHERE id=$3`, payload.Title, payload.Content, id)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		var t Topic
		_ = db.QueryRow(`
			SELECT t.id, t.title, t.content, t.user_id, u.username, t.created_at
			FROM topics t
			JOIN users u ON u.id = t.user_id
			WHERE t.id=$1
		`, id).Scan(&t.ID, &t.Title, &t.Content, &t.UserID, &t.AuthorName, &t.CreatedAt)

		json.NewEncoder(w).Encode(t)

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
			SELECT r.id, r.topic_id, r.content, r.user_id, u.username, r.created_at
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
			if err := rows.Scan(&rp.ID, &rp.TopicID, &rp.Content, &rp.UserID, &rp.AuthorName, &rp.CreatedAt); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			replies = append(replies, rp)
		}

		json.NewEncoder(w).Encode(replies)

	case http.MethodPost:
		uid := getUserID(r)
		if uid == 0 {
			http.Error(w, "Unauthorized", 401)
			return
		}

		var rp Reply
		if err := json.NewDecoder(r.Body).Decode(&rp); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		if rp.TopicID == 0 || strings.TrimSpace(rp.Content) == "" {
			http.Error(w, "topic_id and content required", 400)
			return
		}

		err := db.QueryRow(`
			INSERT INTO replies (topic_id, content, user_id, created_at)
			VALUES ($1, $2, $3, NOW())
			RETURNING id, user_id, created_at
		`, rp.TopicID, rp.Content, uid).Scan(&rp.ID, &rp.UserID, &rp.CreatedAt)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		_ = db.QueryRow(`SELECT username FROM users WHERE id=$1`, rp.UserID).Scan(&rp.AuthorName)

		json.NewEncoder(w).Encode(rp)

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

		_, err := db.Exec(`UPDATE replies SET content=$1 WHERE id=$2`, payload.Content, replyID)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{
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

		_, err := db.Exec(`DELETE FROM replies WHERE id=$1`, replyID)
		if err != nil {
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
		log.Println("REGISTER DB ERROR:", err)
		http.Error(w, err.Error(), 500)
		return
	}

	user.Password = ""
	json.NewEncoder(w).Encode(user)
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
		`SELECT id, username, email, password_hash, created_at
		 FROM users WHERE email=$1`,
		req.Email,
	).Scan(&user.ID, &user.Username, &user.Email, &hash, &user.CreatedAt)

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

	json.NewEncoder(w).Encode(map[string]any{
		"user":  user,
		"token": token,
	})
}

