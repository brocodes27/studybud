import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import Tesseract from 'tesseract.js';
import { Upload, FileText, Save, Loader2, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

/**
 * QuestionGenerator: Lets students paste notes, upload a PDF, generate practice questions using Gemini AI (via Supabase Edge Function), and review the results.
 * Now supports OCR for image-based PDFs using Tesseract.js.
 */
export function QuestionGenerator() {
  const [notes, setNotes] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
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

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPdfError(null);
    setPdfLoading(true);
    setOcrProgress(null);
    try {
      const file = e.target.files?.[0];
      if (!file) throw new Error('No file selected');
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        text += pageText + '\n';
      }
      // If text is too short, try OCR
      if (text.replace(/\s/g, '').length < 30) {
        let ocrText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          setOcrProgress(Math.round((i - 1) / pdf.numPages * 100));
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          // @ts-ignore
          await page.render({ canvasContext: context, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/png');
          const { data: { text: ocrPageText } } = await Tesseract.recognize(dataUrl, 'eng', {
            logger: m => {
              if (m.status === 'recognizing text') {
                setOcrProgress(Math.round(((i - 1) + m.progress) / pdf.numPages * 100));
              }
            }
          });
          ocrText += ocrPageText + '\n';
        }
        setOcrProgress(100);
        setNotes(ocrText.trim());
      } else {
        setNotes(text.trim());
      }
    } catch (err: any) {
      setPdfError('Failed to extract text from PDF. Please try another file.');
    } finally {
      setPdfLoading(false);
      setOcrProgress(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 glass-panel rounded-2xl border border-white/10 shadow-xl mt-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-neon-purple to-pink-600 p-2 rounded-lg shadow-lg shadow-neon-purple/20">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white">AI Question Generator</h2>
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <div className="relative">
          <textarea
            className="w-full h-48 p-4 rounded-xl bg-black/40 text-white border border-white/10 focus:border-neon-purple focus:outline-none focus:ring-1 focus:ring-neon-purple resize-none transition-all"
            placeholder="Paste your notes here..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <div className="absolute bottom-4 right-4 text-xs text-gray-500">
            {notes.length} characters
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
          <div className="flex-shrink-0 bg-white/10 p-2 rounded-lg">
            <Upload className="h-5 w-5 text-neon-blue" />
          </div>
          <div className="flex-grow">
            <label className="text-gray-300 font-medium block mb-1">Upload PDF Notes</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={handlePdfUpload}
              className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neon-blue/10 file:text-neon-blue hover:file:bg-neon-blue/20 transition-all cursor-pointer"
              disabled={pdfLoading}
            />
          </div>
          {pdfLoading && (
            <div className="flex items-center gap-2 text-neon-blue text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              {ocrProgress !== null ? `OCR: ${ocrProgress}%` : 'Extracting...'}
            </div>
          )}
        </div>
        {pdfError && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
            <AlertCircle className="h-4 w-4" />
            {pdfError}
          </div>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">Topic Name <span className="text-red-400">*</span></label>
        <input
          className="w-full p-3 rounded-xl bg-black/40 text-white border border-white/10 focus:border-neon-purple focus:outline-none focus:ring-1 focus:ring-neon-purple transition-all"
          placeholder="e.g., Thermodynamics, Organic Chemistry"
          value={topic}
          onChange={e => setTopic(e.target.value)}
        />
        {topicError && <div className="text-red-400 text-sm mt-2">{topicError}</div>}
      </div>

      <button
        className="w-full bg-gradient-to-r from-neon-purple to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neon-purple/20 transition-all transform hover:scale-[1.02]"
        onClick={handleGenerate}
        disabled={loading || !notes.trim()}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Generating Questions...
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Questions
          </div>
        )}
      </button>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {questions.length > 0 && (
        <div className="mt-8 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-neon-blue" />
              Generated Questions
            </h3>
            <div className="flex items-center gap-2">
              <button
                className={`flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 transition-all shadow-lg shadow-green-600/20`}
                onClick={handleSaveAll}
                disabled={saveAllStatus === 'saving' || saveAllStatus === 'saved'}
              >
                {saveAllStatus === 'saving' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : saveAllStatus === 'saved' ? (
                  <>
                    <CheckCircle className="h-4 w-4" /> All Saved!
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save as Flashcards
                  </>
                )}
              </button>
            </div>
          </div>

          {saveAllStatus === 'error' && (
            <div className="mb-4 text-red-400 text-sm bg-red-500/10 p-2 rounded border border-red-500/20">
              Error saving flashcards. Please try again.
            </div>
          )}

          <ul className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {questions.map((q, i) => (
              <li key={i} className="glass-card p-4 rounded-xl text-gray-200 border border-white/5 hover:border-white/20 transition-all flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-neon-blue">
                  {i + 1}
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}