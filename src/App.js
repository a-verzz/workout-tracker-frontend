import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Capacitor, registerPlugin } from '@capacitor/core';
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
  Repeat,
  RotateCcw,
  Save,
  Square,
  Trash2,
  X
} from 'lucide-react';
import './App.css';

const WorkoutTimer = registerPlugin('WorkoutTimer');

const STORAGE_KEY = 'workeeto.workouts';
const LEGACY_STORAGE_KEY = 'workout-tracker.workouts';
const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';
const storageMode = process.env.REACT_APP_STORAGE_MODE || 'local';
const weekDays = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' }
];

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date, days) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};
const dayOfWeek = (date) => new Date(`${date}T00:00:00`).getDay();
const formatTime = (seconds = 0) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const remainingSeconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
};
const secondsToLabel = (seconds = 0) => {
  if (!seconds) {
    return '0s';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
};

const normalizeWorkout = (workout) => ({
  ...workout,
  date: workout.date || today(),
  duration: Number(workout.duration) || 0,
  actualDuration: Number(workout.actualDuration) || Math.floor((Number(workout.actualSeconds) || 0) / 60),
  actualSeconds: Number(workout.actualSeconds) || (Number(workout.actualDuration) || 0) * 60,
  completed: Boolean(workout.completed),
  repeatMode: workout.repeatMode || 'once',
  repeatDays: Array.isArray(workout.repeatDays) ? workout.repeatDays.map(Number) : [],
  skipped: Boolean(workout.skipped),
  isOverride: Boolean(workout.isOverride)
});

const createBlankWorkout = () => ({
  name: '',
  date: today(),
  duration: 45,
  actualDuration: 0,
  actualSeconds: 0,
  completed: false,
  completedAt: null,
  category: 'Strength',
  targetMuscle: 'Full body',
  intensity: 'Moderate',
  calories: 250,
  notes: '',
  repeatMode: 'once',
  repeatDays: []
});

const seedWorkouts = () => [
  {
    ...createBlankWorkout(),
    id: crypto.randomUUID(),
    name: 'Upper Body Strength',
    duration: 45,
    category: 'Strength',
    targetMuscle: 'Chest, shoulders, triceps',
    intensity: 'Moderate',
    calories: 320,
    notes: 'Bench press, shoulder press, dips, push-ups',
    repeatMode: 'weekdays',
    repeatDays: [1, 3, 5]
  },
  {
    ...createBlankWorkout(),
    id: crypto.randomUUID(),
    name: 'Zone 2 Run',
    duration: 30,
    actualDuration: 28,
    actualSeconds: 1680,
    completed: true,
    completedAt: new Date().toISOString(),
    category: 'Cardio',
    targetMuscle: 'Endurance',
    intensity: 'Easy',
    calories: 240,
    notes: 'Keep heart rate controlled'
  }
];

const repeatsOnDate = (workout, date) => {
  if (workout.isOverride || workout.skipped || date < workout.date) {
    return false;
  }

  if (workout.repeatMode === 'daily') {
    return true;
  }

  if (workout.repeatMode === 'weekdays') {
    return workout.repeatDays.includes(dayOfWeek(date));
  }

  return workout.date === date;
};

const getWorkoutsForDate = (workouts, date) => {
  const normalized = workouts.map(normalizeWorkout);
  const overrides = normalized.filter((workout) => workout.isOverride && workout.date === date);
  const overrideByParent = new Map(overrides.map((workout) => [workout.parentId, workout]));
  const occurrences = [];

  normalized
    .filter((workout) => !workout.isOverride && repeatsOnDate(workout, date))
    .forEach((workout) => {
      const override = overrideByParent.get(workout.id);
      if (override?.skipped) {
        return;
      }

      occurrences.push({
        ...workout,
        ...override,
        id: override?.id || workout.id,
        sourceId: workout.id,
        overrideId: override?.id,
        date,
        occurrenceDate: date,
        occurrenceKey: `${workout.id}:${date}`,
        isGenerated: workout.repeatMode !== 'once' && !override
      });
    });

  overrides
    .filter((workout) => !workout.parentId && !workout.skipped)
    .forEach((workout) => occurrences.push({ ...workout, occurrenceDate: date, occurrenceKey: workout.id }));

  return occurrences.sort((a, b) => a.name.localeCompare(b.name));
};

const getRangeOccurrences = (workouts, startDate, days) => (
  Array.from({ length: days }, (_, index) => addDays(startDate, index))
    .flatMap((date) => getWorkoutsForDate(workouts, date))
);

function App() {
  const [workouts, setWorkouts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [view, setView] = useState('today');
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [activeWorkoutKey, setActiveWorkoutKey] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [confirmStop, setConfirmStop] = useState(false);
  const [pendingNotifAction, setPendingNotifAction] = useState(null);

  const activeWorkoutRef = useRef(null);

  const isApiMode = storageMode === 'api';

  useEffect(() => {
    loadWorkouts();
  }, []);

  useEffect(() => {
    if (!activeWorkoutKey) {
      return undefined;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeWorkoutKey]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle;
    WorkoutTimer.addListener('timerAction', (data) => {
      setPendingNotifAction(data);
    }).then((h) => { handle = h; });
    return () => { if (handle) handle.remove(); };
  }, []);

  const persistLocal = (nextWorkouts) => {
    const normalized = nextWorkouts.map(normalizeWorkout);
    setWorkouts(normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  };

  const loadWorkouts = async () => {
    if (isApiMode) {
      const response = await axios.get(`${apiBaseUrl}/api/workouts`);
      setWorkouts(response.data.map(normalizeWorkout));
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    const nextWorkouts = saved ? JSON.parse(saved).map(normalizeWorkout) : seedWorkouts();
    persistLocal(nextWorkouts);
  };

  const saveWorkout = async (workout) => {
    const normalized = normalizeWorkout({
      ...workout,
      completedAt: workout.completed ? workout.completedAt || new Date().toISOString() : null
    });

    if (isApiMode) {
      if (normalized.id) {
        const response = await axios.put(`${apiBaseUrl}/api/workouts/${normalized.id}`, normalized);
        setWorkouts((current) => current.map((item) => (item.id === normalized.id ? normalizeWorkout(response.data) : item)));
      } else {
        const response = await axios.post(`${apiBaseUrl}/api/workouts`, normalized);
        setWorkouts((current) => [...current, normalizeWorkout(response.data)]);
      }
    } else {
      const nextWorkout = normalized.id ? normalized : { ...normalized, id: crypto.randomUUID() };
      const nextWorkouts = normalized.id
        ? workouts.map((item) => (item.id === normalized.id ? nextWorkout : item))
        : [...workouts, nextWorkout];
      persistLocal(nextWorkouts);
    }

    setEditingWorkout(null);
  };

  const upsertOccurrence = async (occurrence, changes) => {
    const isExistingRecord = !occurrence.sourceId || occurrence.overrideId || occurrence.repeatMode === 'once';

    if (isApiMode) {
      if (isExistingRecord) {
        const id = occurrence.overrideId || occurrence.id;
        const existing = workouts.find((w) => w.id === id) || occurrence;
        const updated = normalizeWorkout({ ...existing, ...changes });
        const response = await axios.put(`${apiBaseUrl}/api/workouts/${id}`, updated);
        setWorkouts((prev) => prev.map((w) => (w.id === id ? normalizeWorkout(response.data) : w)));
      } else {
        const override = normalizeWorkout({
          ...occurrence,
          ...changes,
          id: undefined,
          parentId: occurrence.sourceId,
          date: occurrence.occurrenceDate,
          repeatMode: 'once',
          repeatDays: [],
          isOverride: true
        });
        const response = await axios.post(`${apiBaseUrl}/api/workouts`, override);
        setWorkouts((prev) => [...prev, normalizeWorkout(response.data)]);
      }
      return;
    }

    if (isExistingRecord) {
      const id = occurrence.overrideId || occurrence.id;
      persistLocal(workouts.map((item) => (item.id === id ? normalizeWorkout({ ...item, ...changes }) : item)));
      return;
    }

    persistLocal([
      ...workouts,
      normalizeWorkout({
        ...occurrence,
        ...changes,
        id: crypto.randomUUID(),
        parentId: occurrence.sourceId,
        date: occurrence.occurrenceDate,
        repeatMode: 'once',
        repeatDays: [],
        isOverride: true
      })
    ]);
  };

  const deleteWorkout = async (workout) => {
    const isGeneratedRecurring = workout.sourceId && workout.repeatMode !== 'once' && !workout.overrideId;

    if (isApiMode) {
      if (isGeneratedRecurring) {
        const skipOverride = normalizeWorkout({
          ...workout,
          id: undefined,
          parentId: workout.sourceId,
          date: workout.occurrenceDate,
          repeatMode: 'once',
          repeatDays: [],
          isOverride: true,
          skipped: true
        });
        const response = await axios.post(`${apiBaseUrl}/api/workouts`, skipOverride);
        setWorkouts((prev) => [...prev, normalizeWorkout(response.data)]);
      } else {
        const deleteId = workout.overrideId || workout.id;
        await axios.delete(`${apiBaseUrl}/api/workouts/${deleteId}`);
        setWorkouts((prev) => prev.filter((w) => w.id !== deleteId && w.parentId !== deleteId));
      }
      return;
    }

    if (isGeneratedRecurring) {
      persistLocal([
        ...workouts,
        normalizeWorkout({
          ...workout,
          id: crypto.randomUUID(),
          parentId: workout.sourceId,
          date: workout.occurrenceDate,
          repeatMode: 'once',
          repeatDays: [],
          isOverride: true,
          skipped: true
        })
      ]);
      return;
    }

    const deleteId = workout.overrideId || workout.id;
    persistLocal(workouts.filter((item) => item.id !== deleteId && item.parentId !== deleteId));
  };

  const completeWorkout = async (workout, seconds = 0) => {
    const actualSeconds = Math.max(workout.actualSeconds || 0, seconds);
    const actualDuration = Math.floor(actualSeconds / 60);
    await upsertOccurrence(workout, {
      completed: true,
      completedAt: new Date().toISOString(),
      actualSeconds,
      actualDuration
    });
    setActiveWorkoutKey(null);
    setElapsedSeconds(0);
    if (Capacitor.isNativePlatform()) WorkoutTimer.stopTimer();
  };

  const toggleComplete = (workout) => {
    if (!workout.completed) {
      completeWorkout(workout);
      return;
    }

    upsertOccurrence(workout, { completed: false, completedAt: null, actualDuration: 0, actualSeconds: 0 });
  };

  const startTimer = (workout) => {
    setActiveWorkoutKey(workout.occurrenceKey || workout.id);
    setElapsedSeconds(workout.actualSeconds || 0);
    if (Capacitor.isNativePlatform()) {
      WorkoutTimer.startTimer({ name: workout.name, seconds: workout.actualSeconds || 0 });
    }
  };

  const editWorkout = (workout) => {
    if (workout.sourceId && workout.repeatMode !== 'once' && !workout.overrideId) {
      setEditingWorkout({
        ...workout,
        id: undefined,
        parentId: workout.sourceId,
        date: workout.occurrenceDate,
        repeatMode: 'once',
        repeatDays: [],
        isOverride: true,
        editScope: 'date'
      });
      return;
    }

    setEditingWorkout(workout);
  };

  const clearSchedule = () => {
    if (window.confirm(
      'Remove all recurring schedule rules and future workouts?\n' +
      "Today's progress and past history will be preserved."
    )) {
      const todayStr = today();
      const removedMasterIds = new Set(
        workouts
          .filter((w) => !w.isOverride && w.repeatMode !== 'once')
          .map((w) => w.id)
      );
      const kept = workouts
        .filter((w) => {
          if (!w.isOverride && w.repeatMode !== 'once') return false;
          if (w.date > todayStr) return false;
          return true;
        })
        .map((w) => (removedMasterIds.has(w.parentId) ? normalizeWorkout({ ...w, parentId: null }) : w));
      persistLocal(kept);
    }
  };

  const selectedWorkouts = useMemo(
    () => getWorkoutsForDate(workouts, selectedDate),
    [workouts, selectedDate]
  );

  const scheduleWorkouts = useMemo(
    () => workouts
      .filter((workout) => !workout.isOverride && !workout.skipped)
      .sort((a, b) => `${a.date}-${a.name}`.localeCompare(`${b.date}-${b.name}`)),
    [workouts]
  );

  const progress = useMemo(() => {
    const occurrences = getRangeOccurrences(workouts, addDays(today(), -14), 29);
    const completed = occurrences.filter((workout) => workout.completed);
    const plannedMinutes = occurrences.reduce((total, workout) => total + (Number(workout.duration) || 0), 0);
    const actualSeconds = completed.reduce((total, workout) => total + (Number(workout.actualSeconds) || 0), 0);
    const calories = completed.reduce((total, workout) => total + (Number(workout.calories) || 0), 0);
    const completionRate = occurrences.length ? Math.round((completed.length / occurrences.length) * 100) : 0;

    return { completed: completed.length, plannedMinutes, actualSeconds, calories, completionRate };
  }, [workouts]);

  const activeWorkout = selectedWorkouts.find((workout) => workout.occurrenceKey === activeWorkoutKey)
    || getRangeOccurrences(workouts, addDays(today(), -7), 21).find((workout) => workout.occurrenceKey === activeWorkoutKey);

  activeWorkoutRef.current = activeWorkout || null;

  useEffect(() => {
    if (!pendingNotifAction) return;
    const workout = activeWorkoutRef.current;
    const secs = pendingNotifAction.elapsedSeconds || elapsedSeconds;
    setPendingNotifAction(null);

    if (pendingNotifAction.action === 'pause') {
      if (workout) upsertOccurrence(workout, { actualSeconds: secs });
      setActiveWorkoutKey(null);
      setElapsedSeconds(0);
    } else if (pendingNotifAction.action === 'done') {
      if (workout) completeWorkout(workout, secs);
    }
  }, [pendingNotifAction]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">WorKeeto</p>
          <h1>Train with a plan.</h1>
        </div>
        <button className="icon-button primary" onClick={() => setEditingWorkout(createBlankWorkout())} aria-label="Add workout">
          <Plus size={22} />
        </button>
      </header>

      <main>
        <section className="stats-grid" aria-label="Workout progress">
          <Metric icon={<Check size={18} />} label="Completed" value={progress.completed} suffix="sessions" />
          <Metric icon={<Clock3 size={18} />} label="Time" value={secondsToLabel(progress.actualSeconds)} suffix="" />
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
              activeWorkoutKey={activeWorkoutKey}
              onComplete={toggleComplete}
              onDelete={deleteWorkout}
              onEdit={editWorkout}
              onStart={startTimer}
              canStart={selectedDate === today()}
              canEdit={selectedDate >= today()}
            />
          </section>
        )}

        {view === 'schedule' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Schedule</h2>
                <p>Repeat workouts by day and keep one plan clean.</p>
              </div>
              <div className="header-actions">
                <button className="icon-button" onClick={clearSchedule} aria-label="Clear schedule">
                  <RotateCcw size={18} />
                </button>
                <button className="text-button" onClick={() => setEditingWorkout(createBlankWorkout())}>
                  <Plus size={17} /> Add
                </button>
              </div>
            </div>
            <WorkoutList
              workouts={scheduleWorkouts}
              activeWorkoutKey={activeWorkoutKey}
              onComplete={toggleComplete}
              onDelete={deleteWorkout}
              onEdit={editWorkout}
              onStart={startTimer}
              scheduleView
              canEdit={true}
            />
          </section>
        )}

        {view === 'progress' && (
          <section className="panel progress-panel">
            <div className="panel-header">
              <div>
                <h2>Progress</h2>
                <p>{secondsToLabel(progress.actualSeconds)} of {progress.plannedMinutes} planned minutes completed</p>
              </div>
            </div>
            <div className="progress-ring" style={{ '--progress': `${progress.completionRate}%` }}>
              <span>{progress.completionRate}%</span>
            </div>
            <div className="progress-bars">
              {['Strength', 'Cardio', 'Mobility', 'Recovery'].map((category) => {
                const categoryWorkouts = getRangeOccurrences(workouts, addDays(today(), -14), 29)
                  .filter((workout) => workout.category === category);
                const total = categoryWorkouts.length;
                const done = categoryWorkouts.filter((workout) => workout.completed).length;
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
          onStop={() => setConfirmStop(true)}
          onFinish={() => completeWorkout(activeWorkout, elapsedSeconds)}
        />
      )}

      {confirmStop && (
        <ConfirmStopDialog
          onKeepGoing={() => setConfirmStop(false)}
          onStop={async () => {
            await upsertOccurrence(activeWorkout, { actualSeconds: elapsedSeconds });
            setActiveWorkoutKey(null);
            setElapsedSeconds(0);
            setConfirmStop(false);
            if (Capacitor.isNativePlatform()) WorkoutTimer.stopTimer();
          }}
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

function WorkoutList({ workouts, activeWorkoutKey, onComplete, onDelete, onEdit, onStart, scheduleView = false, canStart = true, canEdit = true }) {
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
        <article className={workout.completed ? 'workout-card completed' : 'workout-card'} key={workout.occurrenceKey || workout.id}>
          <div className={scheduleView ? 'workout-main schedule-main' : 'workout-main'}>
            {!scheduleView && (
              <button className="check-button" onClick={() => onComplete(workout)} aria-label="Toggle completed">
                {workout.completed && <Check size={18} />}
              </button>
            )}
            <div>
              <div className="workout-title-row">
                <h3>{workout.name || 'Untitled workout'}</h3>
                <span>{workout.intensity}</span>
              </div>
              <p>{workout.category} • {workout.targetMuscle}</p>
              <div className="workout-meta">
                <span><CalendarDays size={14} />{scheduleView ? repeatLabel(workout) : workout.occurrenceDate || workout.date}</span>
                <span><Clock3 size={14} />{workout.completed ? secondsToLabel(workout.actualSeconds) : `${workout.duration} min`}</span>
                <span><Flame size={14} />{workout.calories} kcal</span>
                {workout.isGenerated && <span><Repeat size={14} />Generated</span>}
              </div>
              {workout.notes && <p className="notes">{workout.notes}</p>}
            </div>
          </div>
          <div className="card-actions">
            {!scheduleView && (
              <button className="icon-button" onClick={() => onStart(workout)} disabled={activeWorkoutKey === workout.occurrenceKey || !canStart} aria-label="Start timer">
                <Play size={18} />
              </button>
            )}
            <button className="icon-button" onClick={() => onEdit(workout)} disabled={!canEdit} aria-label="Edit workout">
              <Pencil size={18} />
            </button>
            <button className="icon-button danger" onClick={() => onDelete(workout)} aria-label="Delete workout">
              <Trash2 size={18} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function repeatLabel(workout) {
  if (workout.repeatMode === 'daily') {
    return `Every day from ${workout.date}`;
  }
  if (workout.repeatMode === 'weekdays') {
    const labels = weekDays
      .filter((day) => workout.repeatDays.includes(day.value))
      .map((day) => day.short)
      .join(', ');
    return `${labels || 'No days'} from ${workout.date}`;
  }
  return workout.date;
}

function TimerDock({ workout, seconds, onStop, onFinish }) {
  return (
    <aside className="timer-dock">
      <div>
        <span>Active workout</span>
        <strong>{workout.name}</strong>
      </div>
      <output>{formatTime(seconds)}</output>
      <button className="icon-button" onClick={onStop} aria-label="Stop timer"><Square size={18} /></button>
      <button className="icon-button success" onClick={onFinish} aria-label="Finish workout"><Check size={18} /></button>
    </aside>
  );
}

function WorkoutEditor({ workout, onCancel, onSave }) {
  const [form, setForm] = useState(workout);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const toggleRepeatDay = (value) => {
    const currentDays = form.repeatDays || [];
    const nextDays = currentDays.includes(value)
      ? currentDays.filter((day) => day !== value)
      : [...currentDays, value];
    update('repeatDays', nextDays);
  };
  const isDateOverride = form.isOverride || form.editScope === 'date';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="editor" onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}>
        <div className="editor-header">
          <div>
            <h2>{form.id ? 'Edit workout' : isDateOverride ? 'Change this date' : 'New workout'}</h2>
            {isDateOverride && <p>This change applies only to {form.date}.</p>}
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close editor"><X size={18} /></button>
        </div>

        <label>
          Workout name
          <input value={form.name} onChange={(event) => update('name', event.target.value)} required />
        </label>
        <div className="field-grid">
          <label>
            Start date
            <input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} required />
          </label>
          <label>
            Planned minutes
            <input type="number" min="1" value={form.duration} onChange={(event) => update('duration', event.target.value)} />
          </label>
        </div>

        {!isDateOverride && (
          <section className="repeat-section">
            <label>
              Repeat
              <select value={form.repeatMode || 'once'} onChange={(event) => update('repeatMode', event.target.value)}>
                <option value="once">Only once</option>
                <option value="weekdays">Selected weekdays</option>
                <option value="daily">All days</option>
              </select>
            </label>
            {form.repeatMode === 'weekdays' && (
              <div className="weekday-grid" aria-label="Repeat weekdays">
                {weekDays.map((day) => (
                  <button
                    className={(form.repeatDays || []).includes(day.value) ? 'day-chip active' : 'day-chip'}
                    key={day.value}
                    type="button"
                    onClick={() => toggleRepeatDay(day.value)}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

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

function ConfirmStopDialog({ onKeepGoing, onStop }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="confirm-stop">
        <strong>Stop the timer?</strong>
        <p>Your progress so far will be saved and resumed next time.</p>
        <div className="confirm-stop-actions">
          <button className="save-button" type="button" onClick={onKeepGoing}>Keep going</button>
          <button className="icon-button danger" type="button" onClick={onStop}>Stop timer</button>
        </div>
      </div>
    </div>
  );
}

export default App;
