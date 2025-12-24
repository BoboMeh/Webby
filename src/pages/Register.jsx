import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Header from "../components/Header";
import.meta.env.VITE_API_URL;

export default function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password) {
      setError("All fields are required.");
      return;
    }

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/register`, {
        name,
        email,
        password,
      });

      alert("Account created successfully!");
      navigate("/login");
    } catch (err) {
      console.error(err);
      if (err.response) setError(err.response.data);
      else setError("Something went wrong. Please try again.");
    }
  };

  return (
    <><Header />
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-[350px] rounded-md shadow-md p-6">
        <h2 className="text-2xl font-semibold mb-6">Sign Up</h2>

        {error && <p className="text-red-500 mb-4">{error}</p>}

        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400" />

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
          className="w-full bg-blue-400 hover:bg-blue-500 text-white font-semibold py-3 rounded-md transition"
        >
          Create Account
        </button>

        <p className="text-sm text-center mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-400 cursor-pointer hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div></>
  );
}
