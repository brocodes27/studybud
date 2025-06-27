import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * QuestionGenerator: Lets students paste notes, generate practice questions using Gemini AI (via Supabase Edge Function), and review the results.
 */
export function QuestionGenerator() {
  const [notes, setNotes] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveAllStatus, setSaveAllStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [topicError, setTopicError] = useState<string | null>(null);
  const { user } = useAuth();

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setQuestions([]);
    setSaveAllStatus('idle');
    setTopicError(null);
    try {
      // Call your Supabase Edge Function that wraps Gemini AI
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-questions-from-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate questions');
      }
      const data = await response.json();
      setQuestions(data.questions || []);
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    if (!user?.id || questions.length === 0) return;
    if (!topic.trim()) {
      setTopicError('Please enter a topic for your flashcards.');
      return;
    }
    setSaveAllStatus('saving');
    setTopicError(null);
    const flashcards = questions.map(q => ({
      user_id: user.id,
      topic: topic.trim(),
      question: q,
      answer: '',
    }));
    const { error } = await supabase.from('flashcards').insert(flashcards);
    if (error) {
      setSaveAllStatus('error');
    } else {
      setSaveAllStatus('saved');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-900 rounded-xl shadow-lg mt-8">
      <h2 className="text-2xl font-bold mb-4 text-white">AI-Generated Practice Questions from Notes</h2>
      <textarea
        className="w-full h-40 p-3 rounded-lg bg-gray-800 text-white border border-gray-700 mb-4"
        placeholder="Paste your notes here..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />
      <input
        className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 mb-4"
        placeholder="Enter a topic for these flashcards (required)"
        value={topic}
        onChange={e => setTopic(e.target.value)}
      />
      {topicError && <div className="text-red-400 mb-2">{topicError}</div>}
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg disabled:opacity-50"
        onClick={handleGenerate}
        disabled={loading || !notes.trim()}
      >
        {loading ? 'Generating...' : 'Generate Questions'}
      </button>
      {error && <div className="text-red-400 mt-4">{error}</div>}
      {questions.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center mb-4">
            <button
              className={`bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg disabled:opacity-50 mr-4`}
              onClick={handleSaveAll}
              disabled={saveAllStatus === 'saving' || saveAllStatus === 'saved'}
            >
              {saveAllStatus === 'saving' ? 'Saving...' : saveAllStatus === 'saved' ? 'All Saved!' : 'Save All as Flashcards'}
            </button>
            {saveAllStatus === 'error' && <span className="text-red-400 ml-2">Error saving flashcards</span>}
            {saveAllStatus === 'saved' && <span className="text-green-400 ml-2">All questions saved!</span>}
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Generated Questions:</h3>
          <ul className="space-y-3">
            {questions.map((q, i) => (
              <li key={i} className="bg-gray-800 p-3 rounded text-white border border-gray-700">
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 