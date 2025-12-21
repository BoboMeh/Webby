import React, { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import CreateTopic from "./pages/CreateTopic";
import Topic from "./pages/Topic";
import Login from "./pages/Login";
import Register from "./pages/Register";
import.meta.env.VITE_API_URL;

function App() {
  const [topics, setTopics] = useState([]);

  // auth = { user: {...}, token: "..." } or null
  const [auth, setAuth] = useState(() => {
    const stored = localStorage.getItem("auth");
    return stored ? JSON.parse(stored) : null;
  });

  const user = auth?.user || null;

  // Restore auth on refresh
  useEffect(() => {
    const stored = localStorage.getItem("auth");
    if (stored) setAuth(JSON.parse(stored));
  }, []);

  // Fetch topics (public)
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/topics`)
      .then((res) => res.json())
      .then((data) => setTopics(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
  }, []);

  const addTopic = (topic) => setTopics((prev) => [topic, ...(prev || [])]);

  const deleteTopic = async (id) => {
    const token = auth?.token;
    if (!token) return;

    const res = await fetch(`${import.meta.env.VITE_API_URL}/topics/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return;
    setTopics((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTopic = async (topic) => {
    const token = auth?.token;
    if (!token) return;

    const res = await fetch(`${import.meta.env.VITE_API_URL}/topics/${topic.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: topic.title,
        content: topic.content,
      }),
    });

    if (!res.ok) return;
    const updated = await res.json();
    setTopics((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Home
            topics={topics}
            deleteTopic={deleteTopic}
            updateTopic={updateTopic}
            user={user}
            setAuth={setAuth}
            auth={auth}
          />
        }
      />

      <Route
        path="/create-topic"
        element={<CreateTopic addTopic={addTopic} auth={auth} />}
      />

      <Route path="/topic/:id" element={<Topic auth={auth} />} />

      <Route path="/login" element={<Login setAuth={setAuth} />} />

      <Route path="/register" element={<Register />} />
    </Routes>
  );
}

export default App;
