import React, { useEffect, useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { useNavigate } from "react-router-dom";
import userlogo from "../assets/user.png";
import chatlogo from "../assets/dialog.png";
import clocklogo from "../assets/clock.png";

function timeAgo(dateInput, now) {
  if (!dateInput) return "—";

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "—";

  let seconds = Math.floor((now - date.getTime()) / 1000);
  if (seconds < 0) seconds = 0;

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function Home({ topics, deleteTopic, updateTopic, user, setAuth }) {
  const navigate = useNavigate();

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // ✅ live ticker: forces re-render so timeAgo updates
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ✅ dropdown state for per-post actions (Edit/Delete)
  const [menuOpenId, setMenuOpenId] = useState(null);
  useEffect(() => {
    const close = () => setMenuOpenId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const logout = () => {
    localStorage.removeItem("auth");
    setAuth(null);
    navigate("/login");
  };

  const startEdit = (topic) => {
    setEditingId(topic.id);
    setEditTitle(topic.title);
    setEditContent(topic.content);
    setMenuOpenId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  const saveEdit = () => {
    updateTopic({
      id: editingId,
      title: editTitle,
      content: editContent,
    });
    cancelEdit();
  };

  const list = Array.isArray(topics) ? topics : [];

  return (
    <div>
      <Header
        user={user}
        onLogout={() => {
          localStorage.removeItem("auth");
          setAuth(null);
          navigate("/login");
        }}
      />

      <div className="flex w-full justify-center min-h-screen">
        <div className="w-full md:w-2/3 lg:w-1/3 mr-16 flex flex-col px-4 py-4">
          {/* TOP BAR */}
          <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => {
              if (!user) {
                alert("Please login to your account or sign up for one!");
                return;
              }
              navigate("/create-topic");
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            + New Topic
          </button>
          </div>

          {/* TOPICS */}
          {list.length === 0 ? (
            <p className="text-gray-500">No topics yet.</p>
          ) : (
            <ul className="bg-white">
              {list.map((topic) => {
                const author = topic.author_name || "unknown";
                const isOwner = user && user.id === topic.user_id;

                return (
                  <li
                    key={topic.id}
                    className="relative py-4 border-t border-dotted border-gray-300"
                  >
                    {/* ✅ Top-right dropdown for owner */}
                    {isOwner && editingId !== topic.id && (
                      <div
                        className="absolute top-3 right-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setMenuOpenId(
                              menuOpenId === topic.id ? null : topic.id
                            )
                          }
                          className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                          aria-label="Post actions"
                        >
                          <span className="text-xl leading-none text-gray-600">
                            ⋮
                          </span>
                        </button>

                        {menuOpenId === topic.id && (
                          <div className="absolute right-0 mt-2 w-36 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden z-20">
                            <button
                              type="button"
                              onClick={() => startEdit(topic)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpenId(null);
                                deleteTopic(topic.id);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      {/* Avatar bubble */}
                      <div className="w-12 shrink-0">
                        <div className="w-11 h-11 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                          {topic.author_avatar_url ? (
                            <img
                              src={`${import.meta.env.VITE_API_URL}${topic.author_avatar_url}`}
                              alt={author}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[11px] font-semibold text-gray-700 px-2 text-center leading-tight">
                              {author}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        {editingId === topic.id ? (
                          <>
                            <input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full mb-2 border p-2 rounded"
                            />

                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full border p-2 rounded h-28"
                            />

                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={saveEdit}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="bg-gray-400 text-white px-3 py-1 rounded text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <h3
                              className="font-semibold text-lg text-blue-600 hover:underline cursor-pointer leading-snug"
                              onClick={() => navigate(`/topic/${topic.id}`)}
                            >
                              {topic.title}
                            </h3>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      {/* Author */}
                      <span className="inline-flex items-center gap-1">
                        <img
                          src={userlogo}
                          alt="author"
                          className="w-3.5 h-3.5 object-contain"
                        />
                        <span>{author}</span>
                      </span>

                      {/* Reply count */}
                      <span className="inline-flex items-center gap-1">
                        <img
                          src={chatlogo}
                          alt="replies"
                          className="w-3.5 h-3.5 object-contain"
                        />
                        <span>{topic.reply_count ?? 0}</span>
                      </span>

                      {/* Time */}
                      <span className="inline-flex items-center gap-1">
                        <img
                          src={clocklogo}
                          alt="time"
                          className="w-3.5 h-3.5 object-contain"
                        />
                        <span>{timeAgo(topic.created_at, now)}</span>
                      </span>
                    </div>


                            {topic.content && (
                              <p className="mt-2 text-sm text-gray-700 line-clamp-2">
                                {topic.content}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
              <li className="border-b border-dotted border-gray-300" />
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
