import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Clock, CheckCircle, Upload, FileText, AlertTriangle, Save, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { marked } from 'marked';
import { useNotifications } from '../hooks/useNotifications';
import { SUBJECT_TOTAL_MARKS } from './CBSEExamSimulator';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { pdfFileToImageDataUrls } from '../lib/pdfToImages';
import OpenAIService from '../lib/openaiService';

const EXAM_DURATION = 3 * 60 * 60; // 3 hours in seconds

// Helper to render mixed text and math (delimited by $...$)
function parseMathInline(text: string) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      return <InlineMath key={idx} math={part.slice(1, -1)} errorColor="#cc0000" />;
    }
    return <span key={idx}>{part}</span>;
  });
}

// Robustly extract the Weaknesses section from a Markdown plan
function extractWeaknessesSection(md: string): string {
  if (!md) return '';
  const text = md.replace(/\r\n?/g, '\n');
  // 1) Heading-style sections
  const headingTitles = [
    'Specific\\s+Weaknesses',
    'Key\\s+Weaknesses',
    'Weaknesses',
    'Areas\\s+of\\s+Improvement',
    'Areas\\s+for\\s+Improvement',
    'Needs\\s+Improvement',
    'Gaps\\s+in\\s+Understanding',
    'Common\\s+Errors',
    'Mistakes'
  ].join('|');
  const stopTitles = [
    'Key\\s+Strengths',
    'Strengths',
    'Actionable\\s+Steps',
    'Recommendations',
    'Recommended\\s+Resources',
    'Study\\s+Plan',
    'Motivational\\s+Message',
    'Conclusion',
    'Summary',
    'Next\\s+Steps'
  ].join('|');

  const patterns: RegExp[] = [
    // # Weaknesses\n... until next heading/section
    new RegExp(String.raw`(?:^|\n)\s*(?:#{1,6}\s*)?(?:${headingTitles})\s*:?[\t ]*\n+([\s\S]*?)(?=\n\s*(?:#{1,6}\s*|(?:${stopTitles})\b)|$)`, 'i'),
    // **Weaknesses:** inline label then list/paragraphs
    new RegExp(String.raw`(?:\*\*|__)?(?:${headingTitles})(?:\*\*|__)?:?\s*(?:\n+|\s+)([\s\S]*?)(?=\n\s*(?:#{1,6}\s*|(?:${stopTitles})\b|\*\*|__)|$)`, 'i'),
    // Plain label: Weaknesses: ... (same line or next)
    new RegExp(String.raw`(?:^|\n)\s*(?:${headingTitles})\s*:\s*([\s\S]*?)(?=\n\s*(?:#{1,6}\s*|(?:${stopTitles})\b)|$)`, 'i'),
  ];

  for (const rx of patterns) {
    const m = text.match(rx);
    if (m && m[1]) {
      const body = m[1]
        .replace(/^[-*+]\s+/gm, '') // list bullets
        .replace(/^\d+\.?\s+/gm, '') // numbered lists
        .replace(/\n+/g, ', ')
        .replace(/\s+/g, ' ')
        .trim();
      if (body) return body;
    }
  }
  return '';
}

const CBSEExamSession: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const questions = (location.state && location.state.questions) || [];
  // Get the subject of the attempted paper
  const selectedSubject = (location.state && location.state.selectedSubject) || questions[0]?.subject || '';
  const totalMarks = (location.state && location.state.totalMarks) || 80;
  const useCustomMarks = (location.state && location.state.useCustomMarks) || false;
  const assignmentId = (location.state && location.state.assignmentId) || null;
  const [current, setCurrent] = useState(0);
  // Removed unused answers state
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION);
  const [submitted, setSubmitted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth() as any;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const { showToast } = useToast ? useToast() : { showToast: () => { } };
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  // Helper to parse AI feedback JSON
  let parsedFeedback: any[] = [];
  let totalScore = 0;
  const maxScore = totalMarks || questions.reduce((sum: number, q: any) => sum + (q.marks || q.max_marks || 0), 0) || SUBJECT_TOTAL_MARKS[`${selectedSubject}`] || 80;
  if (aiFeedback) {
    let clean = aiFeedback.trim();
    clean = clean.replace(/^(```json|```|'''json|''')/i, '').replace(/(```|''')$/i, '').trim();
    try {
      parsedFeedback = JSON.parse(clean);
      totalScore = parsedFeedback.reduce((sum: number, q: any) => sum + (q.marks_awarded || 0), 0);
    } catch (e) {
      parsedFeedback = [];
    }
  }
  const [improvementPlan, setImprovementPlan] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const { showNotification } = useNotifications();

  // Save feedback to Supabase
  const handleSaveResults = async () => {
    if (!user?.id || !aiFeedback || !extractedText) return;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      // Extract weaknesses using robust extractor
      const studentWeaknesses = improvementPlan ? extractWeaknessesSection(improvementPlan) : '';
      const { error } = await supabase.from('cbse_exam_attempts').insert({
        user_id: user.id,
        exam_date: new Date().toISOString(),
        answers_text: extractedText,
        ai_feedback: aiFeedback,
        total_score: Math.round(totalScore),
        max_score: maxScore,
        questions_count: parsedFeedback.length,
        answer_sheet_url: uploadedFileUrl,
        student_weaknesses: studentWeaknesses,
        assignment_id: assignmentId,
      });
      if (error) throw error;
      setSaveStatus('saved');
      if (showToast) showToast('Results saved!', 'success');
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err.message || 'Failed to save results');
      if (showToast) showToast('Failed to save results', 'error');
    }
  };

  // Timer logic
  useEffect(() => {
    if (submitted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [submitted]);

  // Format time
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Submit logic
  const handleSubmit = () => {
    setSubmitted(true);
    setShowSummary(true);
  };

  // Navigation
  const next = () => setCurrent((c) => Math.min(c + 1, questions.length - 1));
  const prev = () => setCurrent((c) => Math.max(c - 1, 0));

  // Handle answer sheet upload
  const handleAnswerSheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploading(true);
    try {
      const file = e.target.files?.[0];
      if (!file || !user?.id) throw new Error('No file selected or user not found');
      if (file.type !== 'application/pdf') throw new Error('Only PDF files are supported.');
      const filePath = `${user.id}/exam_${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('answer-sheets').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: publicURLData } = supabase.storage.from('answer-sheets').getPublicUrl(filePath);
      setUploadedFileUrl(publicURLData.publicUrl);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  // OCR extraction logic
  const extractTextFromFile = async (file: File) => {
    setExtracting(true);
    setOcrProgress(null);
    setExtractedText(null);
    try {
      const openai = OpenAIService.getInstance();
      const defaultPrompt =
        'Extract all handwritten answers as clean, plain text in reading order. Preserve question numbers if visible (e.g., Q1, 1., (a)). Remove headers/footers and ignore non-answer artifacts.';

      if (file.type === 'application/pdf') {
        const allImages = await pdfFileToImageDataUrls(file, 1800, 'image/jpeg', 0.85);
        const images = allImages.slice(0, 6);
        const visionText = await openai.analyzeImagesWithVision(images, defaultPrompt);
        setExtractedText((visionText || '').trim());
      } else if (file.type.startsWith('image/')) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const visionText = await openai.analyzeImagesWithVision([dataUrl], defaultPrompt);
        setExtractedText((visionText || '').trim());
      }
    } catch (err: any) {
      setExtractedText('Failed to extract text. Please try another file.');
    }
    setExtracting(false);
    setOcrProgress(null);
  };

  // When a file is uploaded, extract text
  useEffect(() => {
    if (!uploadedFileUrl) return;
    // Fetch the file as a blob and run OCR
    const fetchAndExtract = async () => {
      try {
        setExtractedText(null);
        setExtracting(true);
        setOcrProgress(null);
        const response = await fetch(uploadedFileUrl);
        const blob = await response.blob();
        // Guess file type from blob or url
        let fileType = blob.type;
        if (!fileType || fileType === 'application/octet-stream') {
          if (uploadedFileUrl.endsWith('.pdf')) fileType = 'application/pdf';
          else if (uploadedFileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) fileType = 'image/jpeg';
        }
        const file = new File([blob], uploadedFileUrl.split('/').pop() || 'answer', { type: fileType });
        await extractTextFromFile(file);
      } catch (err) {
        setExtractedText('Failed to fetch or extract text.');
        setExtracting(false);
      }
    };
    fetchAndExtract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFileUrl]);

  // Send extracted text to Gemini for evaluation
  const handleEvaluateWithAI = async () => {
    if (!extractedText) return;
    setAiLoading(true);
    setAiError(null);
    setAiFeedback(null);
    try {
      // New: Provide both questions and answers to Gemini for evaluation
      const questionsList = questions.map((q: any, idx: number) => `${idx + 1}. ${q.question}`).join("\n");
      const prompt = `You are a strict CBSE board examiner. Below is a list of exam questions and a student's handwritten answers (extracted as plain text). The answers may be separated by question numbers like Q1:, Q2:, 1., 2., or may be in order.

Your tasks:
1. For each question, find the corresponding answer from the student's text (by question number or order).
2. Evaluate each answer according to the latest CBSE marking scheme and rubrics.
3. For each question, provide:
   - question_number
   - marks_awarded
   - max_marks
   - feedback (detailed, constructive feedback for the answer)

Return ONLY a valid JSON array, no explanation or extra text. Do NOT wrap the JSON in any Markdown or code block.

Questions:
${questionsList}

Student's answers:
${extractedText}`;
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;
      const body = {
        contents: [{ parts: [{ text: prompt }] }]
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Gemini API error: ' + response.statusText);
      const data = await response.json();
      let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let cleanText = text.trim();
      cleanText = cleanText.replace(/^(```json|```|'''json|''')/i, '').replace(/(```|''')$/i, '').trim();
      setAiFeedback(cleanText);
    } catch (err: any) {
      setAiError(err.message || 'AI evaluation failed');
    }
    setAiLoading(false);
  };

  // Generate personalized improvement plan with Gemini
  const handleGenerateImprovementPlan = async () => {
    if (!extractedText || !aiFeedback) return;
    setPlanLoading(true);
    setPlanError(null);
    setImprovementPlan(null);
    try {
      // In handleGenerateImprovementPlan, use parsedFeedback as the main input for weaknesses and recommendations
      const prompt = `You are an expert CBSE teacher and exam coach. Based on the following student's answers and the detailed AI evaluation, generate a personalized improvement plan and performance analysis.

You must:
- Carefully analyze all questions that were answered incorrectly or only partially correct, using the detailed feedback for each answer below.
- Spot the student's weaknesses based on these incorrect/partial answers and the feedback provided.
- Base the improvement plan and recommendations on these weaknesses and the feedback array.

First, state the student's total marks out of ${maxScore} (e.g., 'Total Marks: 56/${maxScore}').

The plan should then include: (1) key strengths, (2) specific weaknesses (with reference to the questions answered incorrectly), (3) actionable steps to improve, (4) recommended resources or study strategies, and (5) a motivational message.

Format your response in Markdown.

Detailed AI Feedback (JSON array):
${JSON.stringify(parsedFeedback, null, 2)}`;
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;
      const body = {
        contents: [{ parts: [{ text: prompt }] }]
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Gemini API error: ' + response.statusText);
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      // Remove AI signature/footer if present
      const cleanedText = text
        .replace(/\[.*?\]\s*Expert CBSE Teacher & Exam Coach/gi, '')
        .replace(/\[Your Name\/Teacher'?s Name\][\s\S]*?Expert CBSE Teacher & Exam Coach/gi, '')
        .replace(/\[.*?\][\s\S]*?Expert CBSE Teacher & Exam Coach/gi, '')
        .replace(/Expert CBSE Teacher & Exam Coach/gi, '')
        .replace(/Best regards[.,\s]*/gi, '')
        .trim();
      setImprovementPlan(cleanedText);

      // Extract weaknesses section using robust extractor, with fallback from parsedFeedback
      let weaknesses = extractWeaknessesSection(cleanedText);
      if (!weaknesses) {
        const fallback = (parsedFeedback || [])
          .filter((q: any) => (q?.marks_awarded ?? 0) < (q?.max_marks ?? 0))
          .map((q: any, i: number) => {
            const qn = q?.question_number ?? i + 1;
            const fb = (q?.feedback || '').toString().replace(/\s+/g, ' ').trim();
            return `Q${qn}: ${fb || 'Needs improvement'}`;
          })
          .slice(0, 8)
          .join(', ');
        if (fallback) {
          weaknesses = fallback;
        }
      }
      // Get student name (fallback to email)
      const studentName = user?.full_name || user?.email?.split('@')[0] || 'Student';
      // Get all classes for the student
      const { data: classMemberships } = await supabase
        .from('class_members')
        .select('class_id')
        .eq('user_id', user.id);

      // Save feedback to Supabase and get attempt id
      let attemptId = null;
      if (user?.id && aiFeedback && extractedText) {
        setSaveStatus('saving');
        setSaveError(null);
        try {
          // Use extracted weaknesses (or fallback) to avoid state update race conditions
          const studentWeaknesses = weaknesses || 'No specific weaknesses section found.';
          const { data: attemptInsert, error } = await supabase.from('cbse_exam_attempts').insert({
            user_id: user.id,
            exam_date: new Date().toISOString(),
            answers_text: extractedText,
            ai_feedback: aiFeedback,
            total_score: Math.round(totalScore),
            max_score: maxScore,
            questions_count: parsedFeedback.length,
            answer_sheet_url: uploadedFileUrl,
            student_weaknesses: studentWeaknesses,
            assignment_id: assignmentId,
          }).select('id').single();
          if (error) throw error;
          attemptId = attemptInsert?.id;
          setSaveStatus('saved');
          if (showToast) showToast('Results saved!', 'success');

          // Send notification to each teacher only after attemptId is available
          if (Array.isArray(classMemberships)) {
            for (const membership of classMemberships) {
              const { data: classInfo } = await supabase
                .from('classes')
                .select('teacher_id, subject')
                .eq('id', membership.class_id)
                .single();

              if (
                classInfo &&
                classInfo.teacher_id &&
                attemptId &&
                classInfo.subject &&
                selectedSubject &&
                classInfo.subject.toLowerCase() === selectedSubject.toLowerCase()
              ) {
                const { error: notificationError } = await supabase.from('notifications').insert({
                  user_id: classInfo.teacher_id,
                  class_id: membership.class_id,
                  type: 'system',
                  title: 'Student Weaknesses Identified',
                  message: `${studentName} has these weaknesses, click to view`,
                  action_url: `/teacher/class/${membership.class_id}?attempt=${attemptId}`,
                  attempt_id: attemptId,
                  priority: 'high',
                  is_read: false
                });

                showNotification && showNotification({
                  title: 'Student Weaknesses Identified',
                  body: `${studentName} has these weaknesses, click to view`,
                  tag: 'student-weakness',
                  requireInteraction: true
                });
              }
            }
          }
        } catch (err: any) {
          setSaveStatus('error');
          setSaveError(err.message || 'Failed to save results');
          if (showToast) showToast('Failed to save results', 'error');
        }
      }
    } catch (err: any) {
      setPlanError(err.message || 'Failed to generate improvement plan');
    }
    setPlanLoading(false);
  };

  if (showSummary) {
    return (
      <div className="min-h-screen relative p-4 md:p-8 animate-fade-in">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-neon-green/10 rounded-full blur-3xl -z-10"></div>

        <div className="max-w-4xl mx-auto">
          <div className="glass-panel p-6 md:p-8 rounded-3xl border border-white/10 text-center mb-8">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(0,255,128,0.2)]">
              <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-neon-green" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-black mb-3">Exam Submitted!</h2>
            <p className="text-gray-400 text-sm md:text-lg">Great job completing the exam. Now let's evaluate your performance.</p>
          </div>

          {/* Answer Sheet Upload */}
          <div className="glass-panel p-8 rounded-2xl border border-white/10 mb-8">
            <h3 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
              <Upload className="w-6 h-6 text-neon-blue" />
              Upload Answer Sheet
            </h3>
            <div className="bg-black/40 border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-neon-blue/50 transition-colors">
              <p className="text-gray-400 mb-6">
                Scan your handwritten answers and upload as a single PDF file.
                <br />
                <span className="text-neon-yellow text-sm mt-2 block">Only PDF files supported for AI evaluation.</span>
              </p>
              <label className="inline-flex">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleAnswerSheetUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <span className="bg-neon-blue hover:bg-neon-blue/80 text-black font-bold py-3 px-6 rounded-xl cursor-pointer transition-all shadow-lg shadow-neon-blue/20 flex items-center gap-2">
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Select PDF File
                    </>
                  )}
                </span>
              </label>
              {uploadError && <div className="text-red-400 mt-4 bg-red-500/10 p-2 rounded-lg inline-block">{uploadError}</div>}
              {uploadedFileUrl && (
                <div className="mt-4 text-neon-green flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Uploaded successfully!
                  <a href={uploadedFileUrl} target="_blank" rel="noopener noreferrer" className="text-black underline hover:text-neon-blue ml-2">View File</a>
                </div>
              )}
            </div>
          </div>

          {/* OCR Extracted Text */}
          {uploadedFileUrl && (
            <div className="glass-panel p-8 rounded-2xl border border-white/10 mb-8">
              <h3 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
                <FileText className="w-6 h-6 text-neon-purple" />
                Extracted Text
              </h3>
              {extracting ? (
                <div className="flex items-center justify-center py-12 text-neon-purple">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-neon-purple mr-3"></div>
                  Extracting handwritten text... {ocrProgress !== null ? `(${ocrProgress}%)` : ''}
                </div>
              ) : extractedText ? (
                <div className="relative">
                  <textarea
                    className="w-full h-64 bg-black/40 border border-white/10 rounded-xl p-4 text-gray-300 font-mono text-sm focus:outline-none focus:border-neon-purple/50 custom-scrollbar resize-none"
                    value={extractedText}
                    readOnly
                  />
                  <div className="absolute bottom-4 right-4 text-xs text-gray-500 bg-black/60 px-2 py-1 rounded">Read-only</div>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-8">No text extracted yet.</div>
              )}
            </div>
          )}

          {/* AI Evaluation Button */}
          {uploadedFileUrl && extractedText && (
            <div className="glass-panel p-8 rounded-2xl border border-white/10 mb-8 text-center">
              <h3 className="text-xl font-bold text-black mb-6">Ready for Evaluation?</h3>
              <button
                className="bg-gradient-to-r from-neon-green to-emerald-600 hover:from-neon-green/80 hover:to-emerald-600/80 text-black font-bold py-4 px-8 rounded-xl shadow-lg shadow-neon-green/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mx-auto text-lg"
                onClick={handleEvaluateWithAI}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
                    Evaluating with AI...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-6 h-6" />
                    Evaluate Answer Sheet
                  </>
                )}
              </button>
              {aiError && <div className="text-red-400 mt-4 bg-red-500/10 p-3 rounded-xl border border-red-500/20 inline-block">{aiError}</div>}
            </div>
          )}

          {/* Structured AI Feedback Report */}
          {aiFeedback && parsedFeedback.length > 0 && (
            <div className="glass-panel p-8 rounded-2xl border border-white/10 mb-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-bold text-black flex items-center gap-2">
                  <FileText className="w-6 h-6 text-neon-blue" />
                  Detailed Report Card
                </h3>
                <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/10 w-full md:w-auto flex justify-between md:block">
                  <span className="text-gray-400 text-sm mr-2">Total Score:</span>
                  <span className="text-xl md:text-2xl font-bold text-neon-green">{totalScore} / {maxScore}</span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full text-left">
                  <thead className="bg-white/5 text-gray-300">
                    <tr className="text-xs md:text-base">
                      <th className="px-3 md:px-4 py-3 font-semibold">Q#</th>
                      <th className="px-3 md:px-4 py-3 font-semibold">Marks</th>
                      <th className="px-3 md:px-4 py-3 font-semibold">Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-black/20">
                    {parsedFeedback.map((q, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors text-xs md:text-sm">
                        <td className="px-3 md:px-4 py-3 font-bold text-black">{q.question_number || i + 1}</td>
                        <td className="px-3 md:px-4 py-3">
                          <span className={`font-mono font-bold ${q.marks_awarded === q.max_marks ? 'text-neon-green' : 'text-neon-yellow'}`}>
                            {q.marks_awarded} / {q.max_marks}
                          </span>
                        </td>
                        <td className="px-3 md:px-4 py-3 text-gray-300 whitespace-pre-line">{q.feedback || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  className="bg-neon-blue hover:bg-neon-blue/80 text-black font-bold py-2 px-6 rounded-xl shadow-lg shadow-neon-blue/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  onClick={handleSaveResults}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                      Saving...
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Results
                    </>
                  )}
                </button>
              </div>
              {saveStatus === 'error' && <div className="text-red-400 mt-2 text-right">{saveError}</div>}
            </div>
          )}

          {/* Personalized Improvement Plan */}
          {aiFeedback && (
            <div className="glass-panel p-8 rounded-2xl border border-white/10 mb-8">
              <h3 className="text-xl font-bold text-black mb-6 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-neon-yellow" />
                Personalized Improvement Plan
              </h3>

              {!improvementPlan ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-6">Get a detailed analysis of your weaknesses and a custom study plan.</p>
                  <button
                    className="bg-gradient-to-r from-neon-purple to-pink-600 hover:from-neon-purple/80 hover:to-pink-600/80 text-black font-bold py-3 px-8 rounded-xl shadow-lg shadow-neon-purple/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
                    onClick={handleGenerateImprovementPlan}
                    disabled={planLoading}
                  >
                    {planLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Generating Plan...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        Generate Improvement Plan
                      </>
                    )}
                  </button>
                  {planError && <div className="text-red-400 mt-4">{planError}</div>}
                </div>
              ) : (
                <div className="bg-black/40 rounded-xl border border-white/10 p-6 prose prose-invert max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: marked(improvementPlan) as string }} />
                </div>
              )}
            </div>
          )}

          <div className="text-center">
            <button
              className="text-gray-400 hover:text-black transition-colors flex items-center gap-2 mx-auto"
              onClick={() => setShowSummary(false)}
            >
              <ArrowLeft className="w-4 h-4" />
              Review Questions
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl -z-10"></div>
        <div className="glass-panel p-8 rounded-2xl border border-white/10 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-neon-yellow mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-black mb-2">No Questions Found</h2>
          <p className="text-gray-400 mb-6">No questions were provided for this exam session. Please generate a paper in the CBSE Exam Simulator first.</p>
          <button
            onClick={() => navigate('/cbse-simulator')}
            className="bg-neon-blue hover:bg-neon-blue/80 text-black font-bold py-3 px-6 rounded-xl shadow-lg shadow-neon-blue/20 transition-all"
          >
            Go to CBSE Simulator
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative animate-fade-in">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-neon-blue/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-neon-purple/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-3xl glass-panel rounded-3xl shadow-2xl p-8 border border-white/10 relative">
        {/* Exam Header */}
        <div className="mb-12 md:mb-8 text-center border-b border-white/10 pb-6">
          <h2 className="text-xl md:text-2xl font-bold text-black mb-2">Exam Session</h2>
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 text-xs md:text-sm text-gray-400">
            <span className="bg-white/5 px-2 md:px-3 py-1 rounded-lg border border-white/5">Subject: <span className="text-neon-blue">{selectedSubject}</span></span>
            <span className="bg-white/5 px-2 md:px-3 py-1 rounded-lg border border-white/5">Total Marks: <span className="text-neon-green">{maxScore}</span></span>
            {useCustomMarks && <span className="text-neon-yellow text-[10px] md:text-xs bg-neon-yellow/10 px-2 py-1 rounded border border-neon-yellow/20 uppercase font-black">Custom</span>}
          </div>
        </div>

        {/* Timer */}
        <div className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center gap-2 text-neon-yellow font-mono text-sm md:text-xl font-bold bg-black/40 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-white/10 shadow-lg">
          <Clock className="w-4 h-4 md:w-5 md:h-5 text-neon-yellow" /> {formatTime(timeLeft)}
        </div>

        {/* Progress */}
        <div className="mb-6 flex items-center justify-between">
          <div className="text-neon-blue font-semibold text-lg">
            Question {current + 1} <span className="text-gray-500 text-sm">of {questions.length}</span>
          </div>
          <div className="w-1/3 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-neon-blue transition-all duration-300"
              style={{ width: `${((current + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-black/40 rounded-2xl p-8 border border-white/10 shadow-inner mb-8 min-h-[300px] flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-neon-blue/20 text-neon-blue px-3 py-1 rounded-lg text-xs font-bold tracking-widest border border-neon-blue/30">SECTION {q.section || 'A'}</span>
            <span className="bg-white/10 text-gray-300 px-3 py-1 rounded-lg text-xs uppercase tracking-wide border border-white/5">{q.type}</span>
            <span className="ml-auto text-neon-yellow font-bold bg-neon-yellow/10 px-3 py-1 rounded-lg border border-neon-yellow/20">[{q.marks} Marks]</span>
          </div>

          <div className="text-black text-lg md:text-xl font-medium leading-relaxed mb-8 flex-1">
            {parseMathInline(q.question)}
          </div>

          {q.type === 'mcq' && q.options && Array.isArray(q.options) && (
            <div className="grid grid-cols-1 gap-3">
              {q.options.map((option: string, optIndex: number) => (
                <div key={optIndex} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-neon-blue/20 text-neon-blue flex items-center justify-center font-bold border border-neon-blue/30">
                    {String.fromCharCode(65 + optIndex)}
                  </div>
                  <span className="text-gray-200 text-lg">{parseMathInline(option)}</span>
                </div>
              ))}
            </div>
          )}

          {q.type === 'mcq' && (!q.options || !Array.isArray(q.options)) && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-200 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              MCQ options not properly generated. Please regenerate the paper.
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <button
            className="text-gray-400 hover:text-black px-6 py-3 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
            onClick={prev}
            disabled={current === 0}
          >
            <ArrowLeft className="w-5 h-5" /> Previous
          </button>

          {current < questions.length - 1 ? (
            <button
              className="bg-white/10 hover:bg-white/20 text-black px-8 py-3 rounded-xl border border-white/10 transition-all hover:scale-105 flex items-center gap-2 font-bold"
              onClick={next}
            >
              Next <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              className="bg-neon-green hover:bg-neon-green/80 text-black px-8 py-3 rounded-xl shadow-lg shadow-neon-green/20 transition-all hover:scale-105 flex items-center gap-2 font-bold"
              onClick={handleSubmit}
            >
              Submit Exam <CheckCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CBSEExamSession;