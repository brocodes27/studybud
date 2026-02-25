import React, { useEffect, useMemo, useState } from 'react';

type MaterialType = 'pdf' | 'note' | 'video' | 'link' | 'other';
type Material = { id: string; title: string; type: MaterialType; path: string; tags: string[] };
type Task = { id: string; text: string; done: boolean; dueDay: number; priority: 'high' | 'medium' | 'low' };

type DashboardData = {
  examDate: string;
  subject: string;
  materials: Material[];
  tasks: Task[];
};

const STORAGE_KEY = 'chemistry_exam_dashboard_v1';

const initialData: DashboardData = {
  examDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  subject: 'Chemistry',
  materials: [
    { id: 'm1', title: 'Organic Chemistry Notes', type: 'note', path: '/materials/organic-notes.md', tags: ['organic', 'revision'] },
    { id: 'm2', title: 'Physical Chemistry Formula Sheet', type: 'pdf', path: '/materials/physical-formulas.pdf', tags: ['physical', 'formulas'] },
    { id: 'm3', title: 'Inorganic PYQ Pack', type: 'pdf', path: '/materials/inorganic-pyq.pdf', tags: ['inorganic', 'pyq'] },
  ],
  tasks: [
    { id: 't1', text: 'Revise Chemical Bonding chapter', done: false, dueDay: 1, priority: 'high' },
    { id: 't2', text: 'Solve 30 Organic Chemistry MCQs', done: false, dueDay: 2, priority: 'high' },
    { id: 't3', text: 'Memorize periodic trends and exceptions', done: false, dueDay: 2, priority: 'medium' },
    { id: 't4', text: 'Practice stoichiometry numericals (20)', done: false, dueDay: 3, priority: 'high' },
    { id: 't5', text: 'Complete 1 full Chemistry mock test', done: false, dueDay: 4, priority: 'high' },
    { id: 't6', text: 'Final formula + reaction quick revision', done: false, dueDay: 5, priority: 'medium' },
  ],
};

function daysLeft(examDate: string): number {
  const now = new Date();
  const exam = new Date(examDate);
  const diff = exam.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function ChemistryExamDashboard() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [newTask, setNewTask] = useState('');
  const [newDue, setNewDue] = useState(1);
  const [newPriority, setNewPriority] = useState<Task['priority']>('medium');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DashboardData;
        setData(parsed);
      }
    } catch {
      // ignore corrupted local storage
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const remainingDays = useMemo(() => daysLeft(data.examDate), [data.examDate]);
  const completed = data.tasks.filter((t) => t.done).length;
  const total = data.tasks.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  const toggleTask = (id: string) => {
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  };

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    const task: Task = {
      id: `t_${Date.now()}`,
      text,
      done: false,
      dueDay: Math.max(1, Math.min(5, newDue)),
      priority: newPriority,
    };
    setData((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
    setNewTask('');
    setNewDue(1);
    setNewPriority('medium');
  };

  const removeTask = (id: string) => {
    setData((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h1 className="text-3xl font-black tracking-tight">{data.subject} Exam Dashboard</h1>
          <p className="text-slate-300 mt-2">Countdown + materials + editable task tracker</p>
          <div className="mt-4 grid md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-800/70 p-4">
              <div className="text-xs uppercase text-slate-400">Days Left</div>
              <div className="text-4xl font-extrabold text-cyan-400">{remainingDays}</div>
            </div>
            <div className="rounded-xl bg-slate-800/70 p-4">
              <div className="text-xs uppercase text-slate-400">Tasks Progress</div>
              <div className="text-4xl font-extrabold text-emerald-400">{progress}%</div>
            </div>
            <div className="rounded-xl bg-slate-800/70 p-4">
              <div className="text-xs uppercase text-slate-400">Completed</div>
              <div className="text-4xl font-extrabold">{completed}/{total}</div>
            </div>
          </div>
        </header>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-bold mb-4">Study Materials</h2>
            <div className="space-y-3">
              {data.materials.map((m) => (
                <div key={m.id} className="p-4 rounded-xl bg-slate-800/70 border border-slate-700">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="font-semibold">{m.title}</div>
                      <div className="text-xs text-slate-400 mt-1">{m.type.toUpperCase()} • {m.path}</div>
                    </div>
                    <div className="text-xs text-slate-300">{m.tags.join(', ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-bold mb-4">Add Task</h2>
            <div className="space-y-3">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="e.g., Revise Electrochemistry NCERT"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 outline-none"
              />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Due Day (1-5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={newDue}
                    onChange={(e) => setNewDue(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as Task['priority'])}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <button onClick={addTask} className="w-full bg-cyan-600 hover:bg-cyan-500 rounded-lg py-2 font-semibold">
                Add Task
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-bold mb-4">Task Tracker</h2>
          <div className="space-y-2">
            {data.tasks
              .slice()
              .sort((a, b) => a.dueDay - b.dueDay)
              .map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-800/70 border border-slate-700">
                  <label className="flex items-center gap-3 flex-1 cursor-pointer">
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                    <span className={t.done ? 'line-through text-slate-400' : ''}>{t.text}</span>
                  </label>
                  <div className="text-xs text-slate-300">Day {t.dueDay}</div>
                  <div className="text-xs uppercase px-2 py-1 rounded bg-slate-700">{t.priority}</div>
                  <button onClick={() => removeTask(t.id)} className="text-red-400 text-xs">Delete</button>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
