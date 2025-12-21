import React from 'react'

function Homebody() {
  return (
    <>
      {/* Action Buttons */}
      <div className="max-w-6xl mx-auto px-4 py-4 flex gap-2">
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          + New Topic
        </button>

        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-600">
          Refresh
        </button>
      </div>
    </>
  );
}

export default Homebody;