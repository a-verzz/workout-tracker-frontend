import React, { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [workouts, setWorkouts] = useState([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");

  const fetchWorkouts = async () => {
    const res = await axios.get('http://localhost:8080/api/workouts');
    setWorkouts(res.data);
  };

  const addWorkout = async () => {
    await axios.post('http://localhost:8080/api/workouts', {
      name,
      duration
    });
    setName("");
    setDuration("");
    fetchWorkouts();
  };

  const deleteWorkout = async (id) => {
await axios.delete(`http://localhost:8080/api/workouts/${id}`);
    fetchWorkouts();
  };

  useEffect(() => {
    fetchWorkouts();
  }, []);

  return (
    <div
  style={{
    maxWidth: "480px",
    margin: "2rem auto",
    padding: "2rem",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    borderRadius: "8px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    backgroundColor: "#f9f9f9",
  }}
>
  <h1 style={{ textAlign: "center", color: "#333", marginBottom: "1.5rem" }}>
    Workout Tracker
  </h1>

  <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
    <input
      type="text"
      placeholder="Workout name"
      value={name}
      onChange={(e) => setName(e.target.value)}
      style={{
        flex: 2,
        padding: "10px",
        borderRadius: "5px",
        border: "1px solid #ccc",
        fontSize: "1rem",
      }}
    />
    <input
      type="number"
      placeholder="Duration (mins)"
      value={duration}
      onChange={(e) => setDuration(e.target.value)}
      style={{
        flex: 1,
        padding: "10px",
        borderRadius: "5px",
        border: "1px solid #ccc",
        fontSize: "1rem",
      }}
    />
  </div>

  <button
    onClick={addWorkout}
    style={{
      width: "100%",
      padding: "12px",
      backgroundColor: "#007bff",
      border: "none",
      borderRadius: "6px",
      color: "white",
      fontSize: "1.1rem",
      cursor: "pointer",
      fontWeight: "600",
      transition: "background-color 0.3s ease",
      marginBottom: "2rem",
    }}
    onMouseEnter={(e) => (e.target.style.backgroundColor = "#0056b3")}
    onMouseLeave={(e) => (e.target.style.backgroundColor = "#007bff")}
  >
    Add Workout
  </button>

  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
    {workouts.map((w) => (
      <li
        key={w.id}
        style={{
          backgroundColor: "white",
          padding: "12px 16px",
          borderRadius: "6px",
          marginBottom: "10px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "1rem",
          color: "#333",
        }}
      >
        <span>
          <strong>{w.name || "Unnamed Workout"}</strong> — {w.duration} min
        </span>

        <button
          onClick={() => deleteWorkout(w.id)}
          style={{
            backgroundColor: "#e74c3c",
            color: "white",
            border: "none",
            padding: "6px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            transition: "background-color 0.3s ease",
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#c0392b")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#e74c3c")}
          aria-label={`Remove workout ${w.name}`}
          title={`Remove workout ${w.name}`}
        >
          Remove
        </button>
      </li>
    ))}
  </ul>
</div>

  );
}

export default App;