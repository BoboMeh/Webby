import React, { useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { useNavigate } from "react-router-dom";


function Home({ topics, deleteTopic, updateTopic, auth, setAuth }) {
  const navigate = useNavigate();
  const user = auth?.user;

  // Track which topic is being edited
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  /* ---------------- LOGOUT ---------------- */
  const logout = () => {
    localStorage.removeItem("auth");
    setAuth(null);
    navigate("/login");
  };

  /* ---------------- EDIT ---------------- */
  const startEdit = (topic) => {
    setEditingId(topic.id);
    setEditTitle(topic.title);
    setEditContent(topic.content);
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

  return (
    <div>
      <Header />

      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex flex-1 flex-col px-4 py-4">
          {/* TOP BAR */}
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => navigate("/create-topic")}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
            >
              + New Topic
            </button>

            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-gray-700 text-sm">
                  Hi, <span className="font-semibold">{user.name}</span>
                </span>

                <button
                  onClick={logout}
                  className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
              >
                Login
              </button>
            )}
          </div>

          {/* TOPICS */}
          <ul>
            {(topics || []).map((topic) => (
              <li
                key={topic.id}
                className="mb-4 border-b-4 border-dotted border-gray-400 pb-3"
              >
                {editingId === topic.id ? (
                  <>
                    {/* EDIT MODE */}
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
                    {/* VIEW MODE */}
                    <h3
                      className="font-semibold text-lg cursor-pointer text-blue-600 hover:underline"
                      onClick={() => navigate(`/topic/${topic.id}`)}
                    >
                      {topic.title}
                    </h3>

                    {/* ✅ AUTHOR LINE */}
                    <p className="text-xs text-gray-500 mb-1">
                      Posted by{" "}
                      <span className="font-medium">
                        {topic.author_name || "Unknown"}
                      </span>
                    </p>

                    <p>{topic.content}</p>

                    {/* OWNER ACTIONS */}
                    {user && user.id === topic.user_id && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => startEdit(topic)}
                          className="bg-yellow-500 text-white px-3 py-1 rounded text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTopic(topic.id)}
                          className="bg-red-500 text-white px-3 py-1 rounded text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>

          {(!topics || topics.length === 0) && (
            <p className="text-gray-500">No topics yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;

