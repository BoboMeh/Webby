import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";

const API_URL = import.meta.env.VITE_API_URL;

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function Search() {
  const query = useQuery().get("q");
  const navigate = useNavigate();

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setResults(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setError("Something went wrong. Please try again.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [query]);

  return (
    <div>
      <Header />

      <div className="max-w-3xl mx-auto p-4">
        <h2 className="text-xl font-semibold mb-4">
          Search results for:{" "}
          <span className="text-blue-600">"{query}"</span>
        </h2>

        {/* Loading */}
        {loading && <p className="text-gray-500">Searching...</p>}

        {/* Error */}
        {!loading && error && (
          <p className="text-red-500">{error}</p>
        )}

        {/* No results */}
        {!loading && !error && results.length === 0 && (
          <p className="text-gray-500 italic">
            No results found.
          </p>
        )}

        {/* Results */}
        <ul className="space-y-4">
          {results.map((topic) => (
            <li
              key={topic.id}
              className="border rounded p-3 hover:bg-gray-50 cursor-pointer"
              onClick={() => navigate(`/topic/${topic.id}`)}
            >
              <h3 className="font-semibold text-blue-600">
                {topic.title}
              </h3>

              <p className="text-sm text-gray-700 mt-1">
                {topic.content.length > 150
                  ? topic.content.slice(0, 150) + "..."
                  : topic.content}
              </p>

              <p className="text-xs text-gray-400 mt-2">
                By {topic.author_name}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Search;
