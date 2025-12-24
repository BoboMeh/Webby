import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import searchlogo from "../assets/search.png";

function Header({ user, onLogout, setAuth }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
    setQuery("");
  };

  // dropdown
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const initials = (user?.name || user?.username || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const doLogout = () => {
    setOpen(false);

    if (onLogout) return onLogout();

    localStorage.removeItem("auth");
    setAuth?.(null);
    navigate("/login");
  };

  return (
    <header className="bg-blue-100 border-b border-blue-200">
      {/* ✅ responsive padding */}
      <div className="mx-auto px-3 sm:px-4 py-3">
        {/* ✅ stack on mobile, row on bigger screens */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {/* Top row (mobile): Logo + right actions */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: App Name */}
            <div
              onClick={() => navigate("/")}
              className="text-[#1D4ED8] ml-1 sm:ml-4 font-bold text-3xl sm:text-4xl cursor-pointer whitespace-nowrap"
            >
              Webby
            </div>

            {/* ✅ Right actions on mobile */}
            {!user ? (
              <div className="flex items-center gap-2 whitespace-nowrap sm:hidden">
                <button
                  onClick={() => navigate("/login")}
                  className="px-3 py-2 text-black text-sm rounded bg-white hover:bg-[#E5E5E5]"
                >
                  Login
                </button>

                <button
                  onClick={() => navigate("/register")}
                  className="px-3 py-2 text-sm bg-[#2563EB] text-white rounded hover:bg-[#1D4ED8]"
                >
                  Sign Up
                </button>
              </div>
            ) : (
              <div className="relative sm:hidden" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-blue-200 bg-white px-2 py-1 shadow-sm hover:bg-blue-50"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                    {user.avatar_url ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL}${user.avatar_url}`}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-gray-700">
                        {initials}
                      </span>
                    )}
                  </div>

                  <svg
                    className={`w-4 h-4 text-gray-600 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {open && (
                  <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg z-50">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs text-gray-500">Signed in as</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {user.name || user.username || "User"}
                      </p>
                    </div>

                    <label className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                      Upload photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          const auth = JSON.parse(
                            localStorage.getItem("auth") || "null"
                          );
                          const token = auth?.token;
                          if (!token) return;

                          const formData = new FormData();
                          formData.append("avatar", file);

                          const res = await fetch(
                            `${import.meta.env.VITE_API_URL}/me/avatar`,
                            {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` },
                              body: formData,
                            }
                          );

                          if (!res.ok) {
                            alert(await res.text());
                            return;
                          }

                          const data = await res.json();

                          const updatedAuth = {
                            ...auth,
                            user: {
                              ...auth.user,
                              avatar_url: data.avatar_url,
                            },
                          };

                          localStorage.setItem(
                            "auth",
                            JSON.stringify(updatedAuth)
                          );
                          setAuth?.(updatedAuth);
                          setOpen(false);
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={doLogout}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ✅ Search bar: full width on mobile */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="w-full sm:flex-1 sm:max-w-xl"
          >
            <div className="flex items-center py-2 rounded-full border border-blue-400 bg-white shadow-sm overflow-hidden">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find anything"
                className="flex-auto px-3 text-sm outline-none text-left sm:text-center"
              />

              <div className="flex h-5 w-px bg-gray-200" />

              <button type="submit" className="mx-2 shrink-0">
                <img
                  src={searchlogo}
                  alt="Search"
                  className="w-6 h-6 object-contain cursor-pointer"
                />
              </button>
            </div>
          </form>

          {/* ✅ Right actions on desktop */}
          {!user ? (
            <div className="hidden sm:flex items-center gap-2 whitespace-nowrap">
              <button
                onClick={() => navigate("/login")}
                className="px-4 py-2 text-black text-sm rounded bg-white hover:bg-[#E5E5E5]"
              >
                Login
              </button>

              <button
                onClick={() => navigate("/register")}
                className="px-4 py-2 text-sm bg-[#2563EB] text-white rounded hover:bg-[#1D4ED8]"
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div className="hidden sm:block relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-blue-200 bg-white px-2 py-1 shadow-sm hover:bg-blue-50"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                  {user.avatar_url ? (
                    <img
                      src={`${import.meta.env.VITE_API_URL}${user.avatar_url}`}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-gray-700">
                      {initials}
                    </span>
                  )}
                </div>

                <svg
                  className={`w-4 h-4 text-gray-600 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500">Signed in as</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {user.name || user.username || "User"}
                    </p>
                  </div>

                  <label className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                    Upload photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        const auth = JSON.parse(
                          localStorage.getItem("auth") || "null"
                        );
                        const token = auth?.token;
                        if (!token) return;

                        const formData = new FormData();
                        formData.append("avatar", file);

                        const res = await fetch(
                          `${import.meta.env.VITE_API_URL}/me/avatar`,
                          {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}` },
                            body: formData,
                          }
                        );

                        if (!res.ok) {
                          alert(await res.text());
                          return;
                        }

                        const data = await res.json();

                        const updatedAuth = {
                          ...auth,
                          user: {
                            ...auth.user,
                            avatar_url: data.avatar_url,
                          },
                        };

                        localStorage.setItem("auth", JSON.stringify(updatedAuth));
                        setAuth?.(updatedAuth);
                        setOpen(false);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={doLogout}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
