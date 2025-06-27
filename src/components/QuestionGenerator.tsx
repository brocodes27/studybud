import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import Tesseract from 'tesseract.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js';

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
    <div className="max-w-2xl mx-auto p-6 bg-gray-900 rounded-xl shadow-lg mt-8">
      <h2 className="text-2xl font-bold mb-4 text-white">AI-Generated Practice Questions from Notes</h2>
      <div className="mb-4 flex flex-col gap-2">
        <textarea
          className="w-full h-40 p-3 rounded-lg bg-gray-800 text-white border border-gray-700"
          placeholder="Paste your notes here..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <label className="text-gray-300 font-medium">or upload PDF:</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={handlePdfUpload}
            className="text-white"
            disabled={pdfLoading}
          />
          {pdfLoading && <span className="text-blue-400 ml-2">Extracting text...</span>}
          {ocrProgress !== null && pdfLoading && (
            <span className="text-yellow-400 ml-2">OCR Progress: {ocrProgress}%</span>
          )}
        </div>
        {pdfError && <div className="text-red-400">{pdfError}</div>}
      </div>
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