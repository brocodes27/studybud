import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';

interface MeetingNote {
  id: string;
  title?: string;
  notes: string;
  screenshots: string[];
  saved_at: string;
}

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<MeetingNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchNote();
    // eslint-disable-next-line
  }, [id]);

  const fetchNote = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('meeting_notes')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      setNote(data);
    } catch (err: any) {
      setError(err.message || 'Note not found');
    }
    setLoading(false);
  };

  if (loading) return <div className="max-w-2xl mx-auto p-6 text-white">Loading...</div>;
  if (error || !note) return <div className="max-w-2xl mx-auto p-6 text-red-400">{error || 'Note not found'}</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-900 rounded-xl shadow-lg mt-8">
      <h2 className="text-3xl font-bold mb-2 text-white">{note.title || 'Untitled'}</h2>
      <div className="text-sm text-gray-400 mb-4">{new Date(note.saved_at).toLocaleString()}</div>
      <div className="mb-6">
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown>{note.notes}</ReactMarkdown>
        </div>
      </div>
      {note.screenshots && note.screenshots.length > 0 && (
        <div className="mb-4">
          <div className="font-semibold text-white mb-2">Screenshots:</div>
          <div className="flex flex-wrap gap-2">
            {note.screenshots.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`Screenshot ${idx + 1}`}
                className="w-32 h-20 object-cover rounded border border-gray-700 shadow"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 