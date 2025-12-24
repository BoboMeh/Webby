import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";

/* ---------------- DATE HELPERS ---------------- */

function hasTimezone(s) {
  return s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s);
}

function normalizeSpaceToT(s) {
  if (typeof s !== "string") return s;
  const trimmed = s.trim();
  if (trimmed.includes(" ") && !trimmed.includes("T")) {
    return trimmed.replace(" ", "T");
  }
  return trimmed;
}

function parseDateSmart(dateInput, nowMs) {
  if (!dateInput) return null;

  if (typeof dateInput === "number") {
    const ms = dateInput < 1e12 ? dateInput * 1000 : dateInput;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  let raw = String(dateInput).trim();
  if (!raw) return null;

  raw = normalizeSpaceToT(raw);

  const candidates = [];

  const d1 = new Date(raw);
  if (!isNaN(d1.getTime())) candidates.push(d1);

  if (!hasTimezone(raw)) {
    const d2 = new Date(raw + "Z");
    if (!isNaN(d2.getTime())) candidates.push(d2);
  }

  if (candidates.length === 0) return null;

  const buffer = 2000;
  const past = candidates.filter((d) => d.getTime() <= nowMs + buffer);

  const pickClosest = (arr) =>
    arr.reduce((best, cur) => {
      const bestDiff = Math.abs(nowMs - best.getTime());
      const curDiff = Math.abs(nowMs - cur.getTime());
      return curDiff < bestDiff ? cur : best;
    });

  return past.length > 0 ? pickClosest(past) : pickClosest(candidates);
}

function timeAgo(dateInput, nowMs) {
  const d = parseDateSmart(dateInput, nowMs);
  if (!d) return "—";

  let seconds = Math.floor((nowMs - d.getTime()) / 1000);
  const future = seconds < 0;
  if (future) seconds = Math.abs(seconds);

  const fmt = (val, unit) =>
    future ? `in ${val} ${unit}` : `${val} ${unit} ago`;
  const fmtShort = (val, unit) =>
    future ? `in ${val}${unit}` : `${val}${unit} ago`;

  if (seconds < 10) return future ? "in a few seconds" : "just now";
  if (seconds < 60) return fmtShort(seconds, "s");

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return fmt(minutes, minutes === 1 ? "minute" : "minutes");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return fmt(hours, hours === 1 ? "hour" : "hours");

  const days = Math.floor(hours / 24);
  if (days < 7) return fmt(days, days === 1 ? "day" : "days");

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return fmt(weeks, weeks === 1 ? "week" : "weeks");

  const months = Math.floor(days / 30);
  if (months < 12) return fmt(months, months === 1 ? "month" : "months");

  const years = Math.floor(days / 365);
  return fmt(years, years === 1 ? "year" : "years");
}

/* ---------------- UI PIECES ---------------- */

function Avatar({ name, avatarUrl }) {
  const initial = (name || "?").trim().slice(0, 1).toUpperCase();
  const src = avatarUrl ? `${import.meta.env.VITE_API_URL}${avatarUrl}` : null;

  return (
    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center overflow-hidden shrink-0">
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-semibold">{initial}</span>
      )}
    </div>
  );
}

function ActionMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600"
        aria-label="More actions"
        title="More"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-36 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden z-50">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * CommentShell (for replies)
 * - renders name + "commented X ago" on top
 */
// function CommentShell({ name, avatarUrl, createdAt, now, actions, children }) {
//   const tooltip = useMemo(() => {
//     const d = parseDateSmart(createdAt, now);
//     return `raw: ${createdAt}\nparsed: ${d ? d.toString() : "invalid"}`;
//   }, [createdAt, now]);

//   return (
//     <div className="flex items-start gap-3 py-4 border-b border-gray-200">
//       <Avatar name={name} avatarUrl={avatarUrl} />

//       <div className="flex-1">
//         <div className="flex items-start justify-between gap-3">
//           <div className="flex items-baseline gap-2">
//             <span className="font-semibold text-gray-900">{name}</span>
//             <span className="text-sm text-gray-500" title={tooltip}>
//               commented {timeAgo(createdAt, now)}
//             </span>
//           </div>
//           {actions}
//         </div>

//         <div className="mt-2 text-gray-800">{children}</div>
//       </div>
//     </div>
//   );
// }

// /**
//  * TopicShell (for main topic post)
//  * - title appears at the top, then author row, then content
//  */
// function TopicShell({
//   title,
//   name,
//   avatarUrl,
//   createdAt,
//   now,
//   actions,
//   children,
// }) {
//   const tooltip = useMemo(() => {
//     const d = parseDateSmart(createdAt, now);
//     return `raw: ${createdAt}\nparsed: ${d ? d.toString() : "invalid"}`;
//   }, [createdAt, now]);

//   return (
//     <div className="py-4 border-b border-gray-200">
//       {/* Title at top (like screenshot) */}
//       <h1 className="text-2xl font-bold text-gray-900 leading-snug">
//         {title}
//       </h1>

//       {/* Author line under title */}
//       <div className="mt-3 flex items-start justify-between gap-3">
//         <div className="flex items-start gap-3">
//           <Avatar name={name} avatarUrl={avatarUrl} />
//           <div className="flex flex-col -mt-0.5">
//             <div className="font-semibold text-gray-900">{name}</div>
//             <div className="text-sm text-gray-500" title={tooltip}>
//               commented {timeAgo(createdAt, now)}
//             </div>
//           </div>
//         </div>

//         {actions}
//       </div>

//       <div className="mt-4 text-gray-800">{children}</div>
//     </div>
//   );
// }

function PostShell({ title, name, avatarUrl, createdAt, now, actions, children }) {
  const tooltip = useMemo(() => {
    const d = parseDateSmart(createdAt, now);
    return `raw: ${createdAt}\nparsed: ${d ? d.toString() : "invalid"}`;
  }, [createdAt, now]);

  const initial = (name || "?").trim().slice(0, 1).toUpperCase();
  const src = avatarUrl ? `${import.meta.env.VITE_API_URL}${avatarUrl}` : null;

  return (
    <article className="py-4 border-b border-gray-200">
      {/* ✅ Title row (topic only) */}
      {title ? (
        <h1 className="text-2xl font-bold text-gray-900 leading-snug mb-3">
          {title}
        </h1>
      ) : null}

      {/* ✅ Header row: avatar | name+time (left) | actions (right) */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center overflow-hidden shrink-0">
          {src ? (
            <img src={src} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-semibold">{initial}</span>
          )}
        </div>

        {/* Main column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            {/* Name + time stacked (same for topic & replies) */}
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 truncate">{name}</div>
              <div className="text-sm text-gray-500" title={tooltip}>
                commented {timeAgo(createdAt, now)}
              </div>
            </div>

            {/* Actions (top right) */}
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>

          {/* Body */}
          <div className="mt-3 text-gray-800 whitespace-pre-wrap">{children}</div>
        </div>
      </div>
    </article>
  );
}


/* ---------------- PAGE ---------------- */

function Topic({ auth, setAuth }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const storedAuth = (() => {
    try {
      return JSON.parse(localStorage.getItem("auth") || "null");
    } catch {
      return null;
    }
  })();

  const liveAuth = auth || storedAuth;
  const token = liveAuth?.token || null;
  const userId = liveAuth?.user?.id || null;

  const [topic, setTopic] = useState(null);
  const [replies, setReplies] = useState([]);
  const [newReply, setNewReply] = useState("");
  const [loading, setLoading] = useState(true);

  const [editingTopic, setEditingTopic] = useState(false);
  const [editTopicTitle, setEditTopicTitle] = useState("");
  const [editTopicContent, setEditTopicContent] = useState("");

  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editReplyContent, setEditReplyContent] = useState("");

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const tRes = await fetch(`${import.meta.env.VITE_API_URL}/topics/${id}`);
      const tData = tRes.ok ? await tRes.json() : null;
      setTopic(tData);

      const rRes = await fetch(
        `${import.meta.env.VITE_API_URL}/replies?topic_id=${id}`
      );
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

    const created = await res.json();
    const safeCreated = {
      ...created,
      created_at: created?.created_at || new Date().toISOString(),
    };

    setReplies((prev) => [...prev, safeCreated]);
    setNewReply("");
  };

  const startEditReply = (r) => {
    setEditingReplyId(r.id);
    setEditReplyContent(r.content);
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
      prev.map((r) =>
        r.id === replyId ? { ...r, content: editReplyContent } : r
      )
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
      <Header
        user={liveAuth?.user}
        setAuth={setAuth}
        onLogout={() => {
          localStorage.removeItem("auth");
          setAuth?.(null);
          navigate("/login");
        }}
      />

      <div className="flex w-full justify-center min-h-screen bg-white">
        <div className="w-full md:w-2/3 lg:w-1/3 flex flex-col px-4 py-4">
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
                <button
                  onClick={saveTopic}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                >
                  Save
                </button>
                <button
                  onClick={cancelEditTopic}
                  className="bg-gray-400 text-white px-3 py-1 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
          <PostShell
            title={topic.title}
            name={topic.author_name || "unknown"}
            avatarUrl={topic.author_avatar_url}
            createdAt={topic.created_at}
            now={now}
            actions={isTopicOwner ? <ActionMenu onEdit={startEditTopic} onDelete={deleteTopic} /> : null}
          >
            {topic.content}
          </PostShell>

          )}

          {/* REPLIES */}
          <div className="mt-2">
            {replies.length === 0 ? (
              <p className="text-gray-500 py-4">No replies yet.</p>
            ) : (
              replies.map((r) => {
                const isReplyOwner = userId && r?.user_id && userId === r.user_id;

                return (
                <PostShell
                  key={r.id}
                  name={r.author_name || "unknown"}
                  avatarUrl={r.author_avatar_url}
                  createdAt={r.created_at}
                  now={now}
                  actions={
                    isReplyOwner ? (
                      <ActionMenu onEdit={() => startEditReply(r)} onDelete={() => deleteReply(r.id)} />
                    ) : null
                  }
                >
                  {editingReplyId === r.id ? (
                    <>
                      <textarea
                        className="w-full border p-2 rounded"
                        value={editReplyContent}
                        onChange={(e) => setEditReplyContent(e.target.value)}
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => saveEditReply(r.id)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditReply}
                          className="bg-gray-400 text-white px-3 py-1 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    r.content
                  )}
                </PostShell>

                );
              })
            )}
          </div>

          {/* Reply box */}
          <div className="py-4">
            <textarea
              className="w-full border p-2 rounded"
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
      </div>
    </div>
  );
}

export default Topic;
