import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

interface MeetingNote {
  id: string;
  notes: string;
  screenshots: string[];
  saved_at: string;
  title?: string;
}

export function MyMeetingNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line
  }, [user?.id]);

  const fetchNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('meeting_notes')
        .select('*')
        .eq('user_id', user?.id)
        .order('saved_at', { ascending: false });
      if (error) throw error;
      setNotes(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notes');
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this note?')) return;
    setDeleting(id);
    try {
      const { error } = await supabase
        .from('meeting_notes')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete note');
    }
    setDeleting(null);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-gray-900 rounded-xl shadow-lg mt-8">
      <h2 className="text-2xl font-bold mb-6 text-white">My Meeting Notes</h2>
      {loading ? (
        <div className="text-white">Loading...</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : notes.length === 0 ? (
        <div className="text-gray-400">No meeting notes saved yet.</div>
      ) : (
        <div className="space-y-4">
          {notes.map(note => {
            const isOpen = expandedId === note.id;
            return (
              <div key={note.id} className="bg-gray-800 rounded-lg shadow border border-gray-700">
                <Link
                  to={`/my-notes/${note.id}`}
                  className="w-full block px-4 py-3 focus:outline-none flex justify-between items-center hover:bg-blue-900 transition-colors rounded-t-lg"
                >
                  <span className="text-lg font-bold text-white">{note.title || 'Untitled'}</span>
                  <span className="text-xs text-gray-400">{new Date(note.saved_at).toLocaleString()}</span>
                </Link>
                {isOpen && (
                  <div className="p-4 border-t border-gray-700">
                    <div className="flex justify-end mb-2">
                      <button
                        className="text-red-400 hover:text-red-600 font-semibold text-xs"
                        onClick={() => handleDelete(note.id)}
                        disabled={deleting === note.id}
                      >
                        {deleting === note.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                    <div className="mb-3">
                      <div className="prose prose-invert max-w-none">
                        <ReactMarkdown>{note.notes}</ReactMarkdown>
                      </div>
                    </div>
                    {note.screenshots && note.screenshots.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {note.screenshots.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={`Screenshot ${idx + 1}`}
                            className="w-32 h-20 object-cover rounded border border-gray-700 shadow"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 