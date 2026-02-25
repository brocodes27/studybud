import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { Mic, Calendar, Trash2, ChevronRight, ExternalLink, Image as ImageIcon } from 'lucide-react';

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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
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
    <div className="min-h-screen relative p-4 md:p-8">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl -z-10"></div>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-gradient-to-br from-neon-purple to-pink-600 p-3 rounded-xl shadow-lg shadow-neon-purple/20">
            <Mic className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">My Meeting Notes</h1>
            <p className="text-gray-400">Review your saved live session notes and screenshots</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-purple"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
            {error}
          </div>
        ) : notes.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl border border-white/10 text-center">
            <div className="bg-slate-800/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mic className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No notes yet</h3>
            <p className="text-gray-400">Join a live session and save notes to see them here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {notes.map(note => (
              <Link
                key={note.id}
                to={`/my-notes/${note.id}`}
                className="glass-card p-6 rounded-2xl border border-white/10 hover:border-neon-purple/30 transition-all duration-300 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  <button
                    onClick={(e) => handleDelete(e, note.id)}
                    disabled={deleting === note.id}
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Delete Note"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="p-2 rounded-lg bg-slate-800/10 text-white">
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-neon-purple transition-colors">
                      {note.title || 'Untitled Session'}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar className="h-4 w-4" />
                      {new Date(note.saved_at).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>

                <div className="prose prose-invert prose-sm max-w-none line-clamp-3 text-gray-300 mb-4">
                  <ReactMarkdown>{note.notes}</ReactMarkdown>
                </div>

                {note.screenshots && note.screenshots.length > 0 && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                    <ImageIcon className="h-4 w-4 text-neon-blue" />
                    <span className="text-sm text-neon-blue font-medium">
                      {note.screenshots.length} Screenshot{note.screenshots.length !== 1 ? 's' : ''} attached
                    </span>
                    <div className="flex -space-x-2 ml-2">
                      {note.screenshots.slice(0, 3).map((img, idx) => (
                        <div key={idx} className="w-8 h-8 rounded-lg border border-white/10 bg-gray-800 overflow-hidden">
                          <img src={img} alt="" className="w-full h-full object-cover opacity-70" />
                        </div>
                      ))}
                      {note.screenshots.length > 3 && (
                        <div className="w-8 h-8 rounded-lg border border-white/10 bg-gray-800 flex items-center justify-center text-[10px] text-white font-medium">
                          +{note.screenshots.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}