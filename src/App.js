import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  Dumbbell,
  Flame,
  Pencil,
  Play,
  Plus,
  Save,
  Square,
  Trash2,
  X
} from 'lucide-react';
import './App.css';

const STORAGE_KEY = 'workout-tracker.workouts';
const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';
const storageMode = process.env.REACT_APP_STORAGE_MODE || 'local';

const today = () => new Date().toISOString().slice(0, 10);

const createBlankWorkout = () => ({
  name: '',
  date: today(),
  duration: 45,
  actualDuration: 0,
  completed: false,
  completedAt: null,
  category: 'Strength',
  targetMuscle: 'Full body',
  intensity: 'Moderate',
  calories: 250,
  notes: ''
});

const seedWorkouts = () => [
  {
    id: crypto.randomUUID(),
    name: 'Upper Body Strength',
    date: today(),
    duration: 45,
    actualDuration: 0,
    completed: false,
    completedAt: null,
    category: 'Strength',
    targetMuscle: 'Chest, shoulders, triceps',
    intensity: 'Moderate',
    calories: 320,
    notes: 'Bench press, shoulder press, dips, push-ups'
  },
  {
    id: crypto.randomUUID(),
    name: 'Zone 2 Run',
    date: today(),
    duration: 30,
    actualDuration: 28,
    completed: true,
    completedAt: new Date().toISOString(),
    category: 'Cardio',
    targetMuscle: 'Endurance',
    intensity: 'Easy',
    calories: 240,
    notes: 'Keep heart rate controlled'
  }
];

function App() {
  const [workouts, setWorkouts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [view, setView] = useState('today');
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isApiMode = storageMode === 'api';

  useEffect(() => {
    loadWorkouts();
  }, []);

  useEffect(() => {
    if (!activeWorkoutId) {
      return undefined;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeWorkoutId]);

  const persistLocal = (nextWorkouts) => {
    setWorkouts(nextWorkouts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextWorkouts));
  };

  const loadWorkouts = async () => {
    if (isApiMode) {
      const response = await axios.get(`${apiBaseUrl}/api/workouts`);
      setWorkouts(response.data);
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    const nextWorkouts = saved ? JSON.parse(saved) : seedWorkouts();
    persistLocal(nextWorkouts);
  };

  const saveWorkout = async (workout) => {
    const normalized = {
      ...workout,
      duration: Number(workout.duration) || 0,
      actualDuration: Number(workout.actualDuration) || 0,
      calories: Number(workout.calories) || 0
    };

    if (isApiMode) {
      if (normalized.id) {
        const response = await axios.put(`${apiBaseUrl}/api/workouts/${normalized.id}`, normalized);
        setWorkouts((current) => current.map((item) => (item.id === normalized.id ? response.data : item)));
      } else {
        const response = await axios.post(`${apiBaseUrl}/api/workouts`, normalized);
        setWorkouts((current) => [...current, response.data]);
      }
    } else {
      const nextWorkouts = normalized.id
        ? workouts.map((item) => (item.id === normalized.id ? normalized : item))
        : [...workouts, { ...normalized, id: crypto.randomUUID() }];
      persistLocal(nextWorkouts);
    }

    setEditingWorkout(null);
  };

  const deleteWorkout = async (id) => {
    if (isApiMode) {
      await axios.delete(`${apiBaseUrl}/api/workouts/${id}`);
      setWorkouts((current) => current.filter((item) => item.id !== id));
      return;
    }

    persistLocal(workouts.filter((item) => item.id !== id));
  };

  const completeWorkout = async (workout, seconds = 0) => {
    const actualDuration = Math.max(workout.actualDuration || 0, Math.ceil(seconds / 60));
    const completedWorkout = {
      ...workout,
      completed: true,
      completedAt: new Date().toISOString(),
      actualDuration
    };

    if (isApiMode) {
      const response = await axios.patch(`${apiBaseUrl}/api/workouts/${workout.id}/complete`, { actualDuration });
      setWorkouts((current) => current.map((item) => (item.id === workout.id ? response.data : item)));
    } else {
      persistLocal(workouts.map((item) => (item.id === workout.id ? completedWorkout : item)));
    }

    setActiveWorkoutId(null);
    setElapsedSeconds(0);
  };

  const toggleComplete = (workout) => {
    if (!workout.completed) {
      completeWorkout(workout);
      return;
    }

    const nextWorkout = { ...workout, completed: false, completedAt: null, actualDuration: 0 };
    persistLocal(workouts.map((item) => (item.id === workout.id ? nextWorkout : item)));
  };

  const startTimer = (workout) => {
    setActiveWorkoutId(workout.id);
    setElapsedSeconds((workout.actualDuration || 0) * 60);
  };

  const selectedWorkouts = useMemo(
    () => workouts.filter((workout) => workout.date === selectedDate),
    [workouts, selectedDate]
  );

  const sortedWorkouts = useMemo(
    () => [...workouts].sort((a, b) => `${a.date}-${a.name}`.localeCompare(`${b.date}-${b.name}`)),
    [workouts]
  );

  const progress = useMemo(() => {
    const completed = workouts.filter((workout) => workout.completed);
    const plannedMinutes = workouts.reduce((total, workout) => total + (Number(workout.duration) || 0), 0);
    const actualMinutes = completed.reduce((total, workout) => total + (Number(workout.actualDuration) || 0), 0);
    const calories = completed.reduce((total, workout) => total + (Number(workout.calories) || 0), 0);
    const completionRate = workouts.length ? Math.round((completed.length / workouts.length) * 100) : 0;

    return { completed: completed.length, plannedMinutes, actualMinutes, calories, completionRate };
  }, [workouts]);

  const activeWorkout = workouts.find((workout) => workout.id === activeWorkoutId);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Workout Tracker</p>
          <h1>Train with a plan.</h1>
        </div>
        <button className="icon-button primary" onClick={() => setEditingWorkout(createBlankWorkout())} aria-label="Add workout">
          <Plus size={22} />
        </button>
      </header>

      <main>
        <section className="stats-grid" aria-label="Workout progress">
          <Metric icon={<Check size={18} />} label="Completed" value={progress.completed} suffix="sessions" />
          <Metric icon={<Clock3 size={18} />} label="Time" value={progress.actualMinutes} suffix="min" />
          <Metric icon={<Flame size={18} />} label="Calories" value={progress.calories} suffix="kcal" />
          <Metric icon={<BarChart3 size={18} />} label="Rate" value={progress.completionRate} suffix="%" />
        </section>

        <nav className="tab-bar" aria-label="Views">
          <TabButton active={view === 'today'} icon={<Activity size={17} />} label="Today" onClick={() => setView('today')} />
          <TabButton active={view === 'schedule'} icon={<CalendarDays size={17} />} label="Schedule" onClick={() => setView('schedule')} />
          <TabButton active={view === 'progress'} icon={<BarChart3 size={17} />} label="Progress" onClick={() => setView('progress')} />
        </nav>

        {view === 'today' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Daily plan</h2>
                <p>{selectedWorkouts.length} workout{selectedWorkouts.length === 1 ? '' : 's'} scheduled</p>
              </div>
              <input className="date-input" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </div>
            <WorkoutList
              workouts={selectedWorkouts}
              activeWorkoutId={activeWorkoutId}
              onComplete={toggleComplete}
              onDelete={deleteWorkout}
              onEdit={setEditingWorkout}
              onStart={startTimer}
            />
          </section>
        )}

        {view === 'schedule' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Schedule</h2>
                <p>Plan ahead, adjust, and keep the week visible.</p>
              </div>
              <button className="text-button" onClick={() => setEditingWorkout(createBlankWorkout())}>
                <Plus size={17} /> Add
              </button>
            </div>
            <WorkoutList
              workouts={sortedWorkouts}
              activeWorkoutId={activeWorkoutId}
              onComplete={toggleComplete}
              onDelete={deleteWorkout}
              onEdit={setEditingWorkout}
              onStart={startTimer}
            />
          </section>
        )}

        {view === 'progress' && (
          <section className="panel progress-panel">
            <div className="panel-header">
              <div>
                <h2>Progress</h2>
                <p>{progress.actualMinutes} of {progress.plannedMinutes} planned minutes completed</p>
              </div>
            </div>
            <div className="progress-ring" style={{ '--progress': `${progress.completionRate}%` }}>
              <span>{progress.completionRate}%</span>
            </div>
            <div className="progress-bars">
              {['Strength', 'Cardio', 'Mobility', 'Recovery'].map((category) => {
                const total = workouts.filter((workout) => workout.category === category).length;
                const done = workouts.filter((workout) => workout.category === category && workout.completed).length;
                const width = total ? `${Math.round((done / total) * 100)}%` : '0%';
                return (
                  <div className="progress-row" key={category}>
                    <span>{category}</span>
                    <div><i style={{ width }} /></div>
                    <strong>{done}/{total}</strong>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {activeWorkout && (
        <TimerDock
          workout={activeWorkout}
          seconds={elapsedSeconds}
          onStop={() => {
            setActiveWorkoutId(null);
            setElapsedSeconds(0);
          }}
          onFinish={() => completeWorkout(activeWorkout, elapsedSeconds)}
        />
      )}

      {editingWorkout && (
        <WorkoutEditor
          workout={editingWorkout}
          onCancel={() => setEditingWorkout(null)}
          onSave={saveWorkout}
        />
      )}
    </div>
  );
}

function Metric({ icon, label, value, suffix }) {
  return (
    <article className="metric">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}<small>{suffix}</small></strong>
    </article>
  );
}

function TabButton({ active, icon, label, onClick }) {
  return (
    <button className={active ? 'tab active' : 'tab'} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function WorkoutList({ workouts, activeWorkoutId, onComplete, onDelete, onEdit, onStart }) {
  if (!workouts.length) {
    return (
      <div className="empty-state">
        <Dumbbell size={28} />
        <h3>No workouts here yet</h3>
        <p>Add a workout to build your schedule.</p>
      </div>
    );
  }

  return (
    <div className="workout-list">
      {workouts.map((workout) => (
        <article className={workout.completed ? 'workout-card completed' : 'workout-card'} key={workout.id}>
          <div className="workout-main">
            <button className="check-button" onClick={() => onComplete(workout)} aria-label="Toggle completed">
              {workout.completed && <Check size={18} />}
            </button>
            <div>
              <div className="workout-title-row">
                <h3>{workout.name || 'Untitled workout'}</h3>
                <span>{workout.intensity}</span>
              </div>
              <p>{workout.category} • {workout.targetMuscle}</p>
              <div className="workout-meta">
                <span><CalendarDays size={14} />{workout.date}</span>
                <span><Clock3 size={14} />{workout.completed ? workout.actualDuration : workout.duration} min</span>
                <span><Flame size={14} />{workout.calories} kcal</span>
              </div>
              {workout.notes && <p className="notes">{workout.notes}</p>}
            </div>
          </div>
          <div className="card-actions">
            <button className="icon-button" onClick={() => onStart(workout)} disabled={activeWorkoutId === workout.id} aria-label="Start timer">
              <Play size={18} />
            </button>
            <button className="icon-button" onClick={() => onEdit(workout)} aria-label="Edit workout">
              <Pencil size={18} />
            </button>
            <button className="icon-button danger" onClick={() => onDelete(workout.id)} aria-label="Delete workout">
              <Trash2 size={18} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function TimerDock({ workout, seconds, onStop, onFinish }) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const remainingSeconds = String(seconds % 60).padStart(2, '0');

  return (
    <aside className="timer-dock">
      <div>
        <span>Active workout</span>
        <strong>{workout.name}</strong>
      </div>
      <output>{minutes}:{remainingSeconds}</output>
      <button className="icon-button" onClick={onStop} aria-label="Stop timer"><Square size={18} /></button>
      <button className="icon-button success" onClick={onFinish} aria-label="Finish workout"><Check size={18} /></button>
    </aside>
  );
}

function WorkoutEditor({ workout, onCancel, onSave }) {
  const [form, setForm] = useState(workout);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="editor" onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}>
        <div className="editor-header">
          <h2>{workout.id ? 'Edit workout' : 'New workout'}</h2>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close editor"><X size={18} /></button>
        </div>

        <label>
          Workout name
          <input value={form.name} onChange={(event) => update('name', event.target.value)} required />
        </label>
        <div className="field-grid">
          <label>
            Date
            <input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} required />
          </label>
          <label>
            Planned minutes
            <input type="number" min="1" value={form.duration} onChange={(event) => update('duration', event.target.value)} />
          </label>
        </div>
        <div className="field-grid">
          <label>
            Category
            <select value={form.category} onChange={(event) => update('category', event.target.value)}>
              <option>Strength</option>
              <option>Cardio</option>
              <option>Mobility</option>
              <option>Recovery</option>
            </select>
          </label>
          <label>
            Intensity
            <select value={form.intensity} onChange={(event) => update('intensity', event.target.value)}>
              <option>Easy</option>
              <option>Moderate</option>
              <option>Hard</option>
            </select>
          </label>
        </div>
        <label>
          Target
          <input value={form.targetMuscle} onChange={(event) => update('targetMuscle', event.target.value)} />
        </label>
        <label>
          Calories
          <input type="number" min="0" value={form.calories} onChange={(event) => update('calories', event.target.value)} />
        </label>
        <label>
          Plan notes
          <textarea rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={form.completed} onChange={(event) => update('completed', event.target.checked)} />
          Mark as completed
        </label>
        <button className="save-button" type="submit"><Save size={18} /> Save workout</button>
      </form>
    </div>
  );
}

export default App;
