import React from "react";
import { useNavigate } from "react-router-dom";

function Header() {
  const navigate = useNavigate();

  return (
    <header className="bg-blue-100 border-b border-blue-200">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        
        {/* Left: App Name */}
        <div className="flex items-center gap-2 text-gray-800 font-semibold">
          <span className="text-xl">8=D</span>
          <span className="text-lg">Webby</span>
        </div>

        {/* Right: Avatar + Buttons (NO GAP) */}
        <div className="flex items-center gap-2">

          <button
            onClick={() => navigate("/login")}
            className="px-3 py-1 text-white text-sm rounded bg-yellow-500 hover:bg-yellow-600"
          >
            Login
          </button>

          <button
            onClick={() => navigate("/register")}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Register
          </button>
        </div>

      </div>
    </header>
  );
}

export default Header;
