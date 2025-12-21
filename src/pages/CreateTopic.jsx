import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import.meta.env.VITE_API_URL;

function CreateTopic({ addTopic, auth }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    // Prefer auth from props; fallback to localStorage
    const stored = localStorage.getItem("auth");
    const currentAuth = auth || (stored ? JSON.parse(stored) : null);
    const token = currentAuth?.token;

    if (!token) {
      alert("You must be logged in to create a topic.");
      navigate("/login");
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/topics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to create topic");
      }

      const newTopic = await res.json();
      addTopic(newTopic);
      navigate("/");
    } catch (err) {
      console.error(err);
      alert(err.message || "Error creating topic");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">Create New Topic</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 rounded"
          required
        />

        <textarea
          placeholder="Write your post..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="border p-2 rounded h-32"
          required
        />

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Publish
        </button>
      </form>
    </div>
  );
}

export default CreateTopic;
