import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import.meta.env.VITE_API_URL;
import Header from "../components/Header";

export default function Login({ setAuth }) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/login`, {
        email,
        password,
      });

      // Backend returns: { user, token }
      const auth = res.data;

      localStorage.setItem("auth", JSON.stringify(auth));
      setAuth(auth);

      navigate("/");
    } catch (err) {
      if (err.response?.data) setError(err.response.data);
      else setError("Login failed. Please try again.");
    }
  };

  return (
    <><Header />
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-[350px] rounded-md shadow-md p-6">
        <h2 className="text-2xl font-semibold mb-6">Login</h2>

        {error && <p className="text-red-500 mb-4">{error}</p>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400" />

        <div className="relative mb-4">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            👁
          </button>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold py-3 rounded-md transition"
        >
          Login
        </button>

        <p className="text-sm text-center mt-4">
          Not registered yet?{" "}
          <Link to="/register" className="text-[#2563EB] cursor-pointer hover:underline">
            Create Account
          </Link>
        </p>
      </div>
    </div></>
  );
}
