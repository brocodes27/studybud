import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Calendar, Image as ImageIcon, Download } from 'lucide-react';

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-purple"></div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl border border-red-500/20 text-center max-w-md">
          <div className="text-red-400 text-xl font-bold mb-2">Error</div>
          <p className="text-gray-400 mb-4">{error || 'Note not found'}</p>
          <Link to="/my-notes" className="text-neon-blue hover:underline">
            Return to Notes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative p-4 md:p-8">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-neon-purple/10 rounded-full blur-3xl -z-10"></div>

      <div className="max-w-4xl mx-auto">
        <Link
          to="/my-notes"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Notes
        </Link>

        <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl shadow-black/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-8 border-b border-white/10">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                {note.title || 'Untitled Session'}
              </h1>
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="h-4 w-4 text-neon-purple" />
                {new Date(note.saved_at).toLocaleString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
          </div>

          <div className="prose prose-invert prose-lg max-w-none mb-12">
            <ReactMarkdown>{note.notes}</ReactMarkdown>
          </div>

          {note.screenshots && note.screenshots.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-white">
                <ImageIcon className="h-5 w-5 text-neon-blue" />
                Captured Screenshots
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {note.screenshots.map((img, idx) => (
                  <div key={idx} className="group relative rounded-xl overflow-hidden border border-white/10 bg-black/40">
                    <img
                      src={img}
                      alt={`Screenshot ${idx + 1}`}
                      className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                      <a
                        href={img}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-white hover:text-neon-blue underline"
                      >
                        View Full Size
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}