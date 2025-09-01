import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const CUET_DOMAINS = [
  'Accountancy/Book-Keeping',
  'Agriculture',
  'Anthropology',
  'Biology/Biological Science/Biotechnology/Biochemistry',
  'Business Studies',
  'Chemistry',
  'Environmental Science',
  'Computer Science/Information Practices',
  'Economics/Business Economics',
  'Fine/Visual/Commercial Arts',
  'Geography/Geology',
  'History',
  'Home Science',
  'Knowledge Traditions–Practices in India',
  'Mass Media/Mass Communication',
  'Mathematics/Applied Mathematics',
  'Performing Arts (Dance/Drama/Music)',
  'Physical Education (Yoga, Sports)',
  'Physics',
  'Political Science',
  'Psychology',
  'Sanskrit',
  'Sociology'
];

const CUETSyllabusDev: React.FC = () => {
  const [subjects, setSubjects] = useState<string[]>(['Physics']);
  const [year, setYear] = useState('2025');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string>('');

  const appendLog = (s: string) => setLog(prev => `${prev}\n${s}`);

  const toggle = (s: string, on: boolean) => {
    setSubjects(prev => on ? Array.from(new Set([...prev, s])) : prev.filter(x => x !== s));
  };

  const selectAll = () => setSubjects([...CUET_DOMAINS]);
  const clearAll = () => setSubjects([]);

  const fetchAndStore = async () => {
    setLoading(true);
    setLog('');
    try {
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
      if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL not set');
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token;
      appendLog(`Calling cuet-syllabus-fetch for ${subjects.length} subjects…`);
      const res = await fetch(`${supabaseUrl}/functions/v1/cuet-syllabus-fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ subjects, year })
      });
      const text = await res.text();
      appendLog(`Edge response ${res.status}: ${text.slice(0, 400)}…`);
      if (!res.ok) throw new Error(text);
      const json = JSON.parse(text);
      const items: any[] = Array.isArray(json?.items) ? json.items : [];
      appendLog(`Received ${items.length} syllabus items. Storing to DB…`);

      // Upsert each syllabus into cuet_syllabi
      for (const it of items) {
        const row = {
          subject: it.subject || 'Unknown',
          year: String(it.year || year),
          topics: it.topics || [],
          sources: it.sources || [],
        } as any;
        const { error } = await supabase.from('cuet_syllabi').upsert(row, {
          onConflict: 'subject,year'
        });
        if (error) throw error;
        appendLog(`Saved: ${row.subject} (${row.year})`);
      }
      appendLog('Done.');
    } catch (e: any) {
      appendLog(`Error: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white">CUET Syllabus Dev</h1>
        <p className="text-gray-300">Fetch syllabus via Tavily + OpenAI and store in DB</p>
      </div>

      <div className="card-elevated">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold text-white">Select CUET Domains</label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="px-3 py-1 rounded bg-gray-800 text-gray-100 border border-gray-700 hover:bg-gray-700">Select All</button>
                <button type="button" onClick={clearAll} className="px-3 py-1 rounded bg-gray-800 text-gray-100 border border-gray-700 hover:bg-gray-700">Clear</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-auto p-2 rounded bg-gray-900/40 border border-gray-800">
              {CUET_DOMAINS.map(d => {
                const checked = subjects.includes(d);
                return (
                  <label key={d} className="flex items-center gap-2 text-gray-200">
                    <input type="checkbox" checked={checked} onChange={(e) => toggle(d, e.target.checked)} />
                    <span>{d}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block mb-2 font-semibold text-white">Year</label>
            <input className="form-input w-full" value={year} onChange={e => setYear(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <button className="btn-primary w-full" disabled={loading} onClick={fetchAndStore}>
              {loading ? 'Working…' : 'Fetch & Store'}
            </button>
          </div>
        </div>
        <div className="mt-4 text-xs whitespace-pre-wrap text-gray-300 max-h-64 overflow-auto border border-gray-800 rounded p-2 bg-gray-900/40">
          {log || 'Ready.'}
        </div>
      </div>
    </div>
  );
};

export default CUETSyllabusDev;
