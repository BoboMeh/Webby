import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import.meta.env.VITE_API_URL;

function Topic({ auth }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const token = auth?.token || null;
  const userId = auth?.user?.id || null;

  const [topic, setTopic] = useState(null);
  const [replies, setReplies] = useState([]);
  const [newReply, setNewReply] = useState("");
  const [loading, setLoading] = useState(true);

  const [editingTopic, setEditingTopic] = useState(false);
  const [editTopicTitle, setEditTopicTitle] = useState("");
  const [editTopicContent, setEditTopicContent] = useState("");

  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editReplyContent, setEditReplyContent] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const tRes = await fetch(`${import.meta.env.VITE_API_URL}/topics/${id}`);
      const tData = tRes.ok ? await tRes.json() : null;
      setTopic(tData);

      const rRes = await fetch(`${import.meta.env.VITE_API_URL}/replies?topic_id=${id}`);
      const rData = rRes.ok ? await rRes.json() : [];
      setReplies(Array.isArray(rData) ? rData : []);
    } catch {
      setTopic(null);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isTopicOwner = userId && topic?.user_id && userId === topic.user_id;

  // ---- Topic edit/delete ----
  const startEditTopic = () => {
    setEditingTopic(true);
    setEditTopicTitle(topic?.title || "");
    setEditTopicContent(topic?.content || "");
  };

  const cancelEditTopic = () => {
    setEditingTopic(false);
    setEditTopicTitle("");
    setEditTopicContent("");
  };

  const saveTopic = async () => {
    if (!token) return navigate("/login");

    const res = await fetch(`${import.meta.env.VITE_API_URL}/topics/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: editTopicTitle, content: editTopicContent }),
    });

    if (!res.ok) return alert(await res.text());

    const updated = await res.json();
    setTopic(updated);
    cancelEditTopic();
  };

  const deleteTopic = async () => {
    if (!token) return navigate("/login");
    if (!window.confirm("Delete this topic?")) return;

    const res = await fetch(`${import.meta.env.VITE_API_URL}/topics/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return alert(await res.text());

    navigate("/");
  };

  // ---- Replies create/edit/delete ----
  const handleReply = async () => {
    if (!token) return navigate("/login");
    if (!newReply.trim()) return;

    const res = await fetch(`${import.meta.env.VITE_API_URL}/replies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ topic_id: Number(id), content: newReply }),
    });

    if (!res.ok) return alert(await res.text());

    const reply = await res.json();
    setReplies((prev) => [...prev, reply]);
    setNewReply("");
  };

  const startEditReply = (reply) => {
    setEditingReplyId(reply.id);
    setEditReplyContent(reply.content);
  };

  const cancelEditReply = () => {
    setEditingReplyId(null);
    setEditReplyContent("");
  };

  const saveEditReply = async (replyId) => {
    if (!token) return navigate("/login");

    const res = await fetch(`${import.meta.env.VITE_API_URL}/replies/${replyId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: editReplyContent }),
    });

    if (!res.ok) return alert(await res.text());

    setReplies((prev) =>
      prev.map((r) => (r.id === replyId ? { ...r, content: editReplyContent } : r))
    );
    cancelEditReply();
  };

  const deleteReply = async (replyId) => {
    if (!token) return navigate("/login");
    if (!window.confirm("Delete this reply?")) return;

    const res = await fetch(`${import.meta.env.VITE_API_URL}/replies/${replyId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return alert(await res.text());

    setReplies((prev) => prev.filter((r) => r.id !== replyId));
  };

  if (loading) return <p className="p-4">Loading...</p>;
  if (!topic) return <p className="p-4">Topic not found</p>;

  return (
    <div>
      <Header />
      <div className="max-w-3xl mx-auto p-4">
        {/* TOPIC */}
        {editingTopic ? (
          <div className="mb-4 border rounded p-3">
            <input
              className="w-full border p-2 rounded mb-2"
              value={editTopicTitle}
              onChange={(e) => setEditTopicTitle(e.target.value)}
            />
            <textarea
              className="w-full border p-2 rounded"
              rows={4}
              value={editTopicContent}
              onChange={(e) => setEditTopicContent(e.target.value)}
            />
            <div className="mt-2 flex gap-2">
              <button onClick={saveTopic} className="bg-green-600 text-white px-3 py-1 rounded text-sm">
                Save
              </button>
              <button onClick={cancelEditTopic} className="bg-gray-400 text-white px-3 py-1 rounded text-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-1">{topic.title}</h2>
            <p className="text-xs text-gray-500 mb-2">
              Posted by <span className="font-medium">{topic.author_name}</span>
            </p>
            <p className="mb-3">{topic.content}</p>

            {isTopicOwner && (
              <div className="mb-4 flex gap-2">
                <button onClick={startEditTopic} className="bg-yellow-500 text-white px-3 py-1 rounded text-sm">
                  Edit Post
                </button>
                <button onClick={deleteTopic} className="bg-red-500 text-white px-3 py-1 rounded text-sm">
                  Delete Post
                </button>
              </div>
            )}
          </>
        )}

        <hr className="my-4" />

        {/* REPLIES */}
        <h3 className="font-semibold mb-3">Replies</h3>

        {replies.length === 0 && <p className="text-gray-500 mb-2">No replies yet.</p>}

        {replies.map((reply) => {
          const isReplyOwner = userId && reply.user_id && userId === reply.user_id;

          return (
            <div key={reply.id} className="mb-3 p-3 border rounded">
              <p className="text-xs text-gray-500 mb-1">
                Replied by <span className="font-medium">{reply.author_name}</span>
              </p>

              {editingReplyId === reply.id ? (
                <>
                  <textarea
                    className="w-full border p-2"
                    value={editReplyContent}
                    onChange={(e) => setEditReplyContent(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => saveEditReply(reply.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm">
                      Save
                    </button>
                    <button onClick={cancelEditReply} className="bg-gray-400 text-white px-3 py-1 rounded text-sm">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>{reply.content}</p>

                  {isReplyOwner && (
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => startEditReply(reply)} className="bg-yellow-500 text-white px-3 py-1 rounded text-sm">
                        Edit
                      </button>
                      <button onClick={() => deleteReply(reply.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm">
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        <textarea
          className="w-full border p-2 mt-4"
          rows={3}
          value={newReply}
          onChange={(e) => setNewReply(e.target.value)}
          placeholder={token ? "Write a reply..." : "Log in to reply..."}
          disabled={!token}
        />

        <button
          onClick={handleReply}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          disabled={!token}
        >
          Reply
        </button>
      </div>
    </div>
  );
}

export default Topic;
