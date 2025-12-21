import React from "react";

function Sidebar() {
    return (
    <div className="w-64 border-r border-gray-200 bg-white px-6 py-6">
      <h3 className="mb-4 text-sm font-semibold text-gray-500 uppercase">
        Categories
      </h3>

      <ul className="space-y-2 text-sm">
        <li className="cursor-pointer text-gray-700 hover:text-indigo-600">
          Get Started
        </li>
        <li className="cursor-pointer text-gray-700 hover:text-indigo-600">
          Community
        </li>
        <li className="cursor-pointer text-gray-700 hover:text-indigo-600">
          HTML & CSS
        </li>
        <li className="cursor-pointer text-gray-700 hover:text-indigo-600">
          JavaScript
        </li>
        <li className="cursor-pointer text-gray-700 hover:text-indigo-600">
          PHP
        </li>
      </ul>
    </div>
    );
}

export default Sidebar;