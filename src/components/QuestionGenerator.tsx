import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import Tesseract from 'tesseract.js';
import { Upload, FileText, Save, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';

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
  const { user } = useAuth() as any;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setQuestions([]);
    setSaveAllStatus('idle');
    setTopicError(null);
    try {
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
      setTopicError('ENTER_TOPIC_LABEL');
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
      if (!file) throw new Error('NO_FILE_DETECTED');
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        text += pageText + '\n';
      }
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
      setPdfError('PDF_EXTRACTION_FAILURE: RETRY_WITH_CLEAN_SOURCE');
    } finally {
      setPdfLoading(false);
      setOcrProgress(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-12 bg-white border-8 border-black shadow-[20px_20px_0px_0px_#000] rotate-1 mt-12 mb-20">
      <div className="flex items-center gap-6 mb-10 border-b-8 border-black pb-8">
        <div className="bg-neo-accent border-4 border-black p-4 shadow-[6px_6px_0px_0px_#000] -rotate-6">
          <Sparkles className="h-10 w-10 text-white stroke-[3px]" />
        </div>
        <div>
          <h2 className="text-4xl font-black text-black uppercase tracking-tighter italic leading-none">QUERY_ARCHITECT</h2>
          <p className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em] mt-2 italic">PROTOCOL: NEURAL_QUESTION_SYNTHESIS</p>
        </div>
      </div>

      <div className="space-y-10">
        <div className="relative group">
          <textarea
            className="w-full h-64 p-8 bg-white border-4 border-black font-black uppercase tracking-tight italic text-xl focus:bg-neo-bg outline-none transition-all shadow-[8px_8px_0px_0px_#000] resize-none"
            placeholder="INSERT_NOTES_DATA_PACKETS_HERE..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <div className="absolute -bottom-4 right-6 bg-black text-white px-4 py-1 font-black uppercase text-[10px] tracking-widest shadow-[4px_4px_0px_0px_#FF6B6B]">
            DATA_VOLUME: {notes.length} BYTES
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-8 p-8 border-4 border-black bg-neo-bg/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 py-1 px-4 bg-black text-white font-black text-[10px] uppercase italic -rotate-1 translate-x-1">
            OCR_OVERRIDE_ACTIVE
          </div>
          <div className="flex-shrink-0 bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000]">
            <Upload className="h-8 w-8 text-black stroke-[3px]" />
          </div>
          <div className="flex-grow space-y-2">
            <label className="text-black font-black uppercase tracking-widest text-xs italic block">SOURCE_PDF_INJECTION</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={handlePdfUpload}
              className="w-full text-xs font-black uppercase italic cursor-pointer file:bg-black file:text-white file:border-none file:px-6 file:py-2 file:mr-4 file:font-black file:uppercase file:italic hover:file:bg-neo-accent transition-all animate-none"
              disabled={pdfLoading}
            />
          </div>
          {pdfLoading && (
            <div className="bg-neo-accent text-white px-6 py-3 border-4 border-black font-black uppercase tracking-tighter italic shadow-[6px_6px_0px_0px_#000] animate-pulse">
              {ocrProgress !== null ? `DECODING: ${ocrProgress}%` : 'EXTRACTING...'}
            </div>
          )}
        </div>

        {pdfError && (
          <div className="flex items-center gap-4 text-white bg-neo-accent border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000]">
            <AlertCircle className="h-6 w-6 stroke-[3px]" />
            <span className="font-black uppercase text-xs italic tracking-widest">{pdfError}</span>
          </div>
        )}

        <div className="space-y-4">
          <label className="text-[10px] font-black text-black uppercase tracking-[0.2em] italic block">CLASSIFICATION_TAG <span className="text-neo-accent">*</span></label>
          <input
            className="w-full py-5 px-8 bg-white border-4 border-black font-black text-2xl uppercase italic tracking-tighter focus:bg-neo-secondary outline-none transition-all shadow-[6px_6px_0px_0px_#000]"
            placeholder="E.G. ORGANIC_SYNTHESIS_ALPHA"
            value={topic}
            onChange={e => setTopic(e.target.value)}
          />
          {topicError && <div className="bg-black text-white px-4 py-1 inline-block font-black uppercase text-[10px] tracking-widest -rotate-2">{topicError}</div>}
        </div>

        <button
          className="w-full bg-black text-white py-8 border-4 border-black font-black uppercase italic tracking-tighter text-4xl hover:bg-neo-accent hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000] disabled:opacity-50"
          onClick={handleGenerate}
          disabled={loading || !notes.trim()}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-6">
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              PROCESSING...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-6">
              <Sparkles className="h-10 w-10 stroke-[4px]" />
              EXECUTE_SYNTHESIS
            </span>
          )}
        </button>

        {error && (
          <div className="flex items-center gap-6 text-white bg-black border-4 border-black p-8 shadow-[8px_8px_0px_0px_#FF6B6B] -rotate-1">
            <AlertCircle className="h-10 w-10 text-neo-accent stroke-[3px]" />
            <span className="text-xl font-black uppercase tracking-tight italic">{error}</span>
          </div>
        )}

        {questions.length > 0 && (
          <div className="mt-16 space-y-10 border-t-8 border-black pt-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-10">
              <h3 className="text-3xl font-black text-black uppercase tracking-tighter italic flex items-center gap-6">
                <div className="bg-neo-secondary border-4 border-black p-3 shadow-[4px_4px_0px_0px_#000]">
                  <FileText className="h-8 w-8 text-black stroke-[3px]" />
                </div>
                SYNTHESIZED_QUERIES
              </h3>
              <button
                className={`
                    px-10 py-5 border-4 border-black font-black uppercase italic tracking-tighter text-xl transition-all shadow-[8px_8px_0px_0px_#000]
                    ${saveAllStatus === 'saved' ? 'bg-neo-secondary text-black' : 'bg-black text-white hover:bg-neo-accent'}
                `}
                onClick={handleSaveAll}
                disabled={saveAllStatus === 'saving' || saveAllStatus === 'saved'}
              >
                {saveAllStatus === 'saving' ? (
                  <span className="flex items-center gap-4">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    LINKING...
                  </span>
                ) : saveAllStatus === 'saved' ? (
                  <span className="flex items-center gap-4">
                    <CheckCircle className="h-6 w-6 stroke-[4px]" /> SUCCESS_INDEXED
                  </span>
                ) : (
                  <span className="flex items-center gap-4">
                    <Save className="h-6 w-6 stroke-[4px]" /> COMMIT_TO_ARCHIVE
                  </span>
                )}
              </button>
            </div>

            {saveAllStatus === 'error' && (
              <div className="bg-neo-accent text-white p-4 border-4 border-black font-black uppercase text-xs tracking-widest text-center italic shadow-[4px_4px_0px_0px_#000]">
                TRANSMISSION_ERROR: ARCHIVE_SYNC_FAILED
              </div>
            )}

            <ul className="grid grid-cols-1 gap-6">
              {questions.map((q, i) => (
                <li key={i} className={`
                    bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_#000] transition-all flex gap-8
                    ${i % 2 === 0 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'}
                `}>
                  <span className="flex-shrink-0 w-12 h-12 border-4 border-black bg-black text-white flex items-center justify-center text-xl font-black italic -rotate-12 translate-x-[-10px]">
                    {i + 1}
                  </span>
                  <span className="text-xl font-black text-black uppercase tracking-tight italic leading-relaxed">{q}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}