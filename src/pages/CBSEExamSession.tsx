import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
import { useToast } from '../hooks/useToast';
import { marked } from 'marked';
import { useNotifications } from '../hooks/useNotifications';

const EXAM_DURATION = 3 * 60 * 60; // 3 hours in seconds

const CBSEExamSession: React.FC = () => {
  const location = useLocation();
  const questions = (location.state && location.state.questions) || [];
  // Get the subject of the attempted paper
  const selectedSubject = (location.state && location.state.selectedSubject) || questions[0]?.subject || '';
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
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
  const { showToast } = useToast ? useToast() : { showToast: () => {} };
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  // Helper to parse AI feedback JSON
  let parsedFeedback: any[] = [];
  let totalScore = 0;
  const maxScore = 80;
  if (aiFeedback) {
    let clean = aiFeedback.trim();
    clean = clean.replace(/^(```json|```|'''json|''')/i, '').replace(/(```|''')$/i, '').trim();
    try {
      parsedFeedback = JSON.parse(clean);
      totalScore = parsedFeedback.reduce((sum, q) => sum + (q.marks_awarded || 0), 0);
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
      // Extract 'specific weaknesses' from the improvement plan (markdown)
      let studentWeaknesses = '';
      if (improvementPlan) {
        // Try to extract the section after 'Specific Weaknesses' or similar
        const match = improvementPlan.match(/specific weaknesses[\s\S]*?(?:\n\n|$)/i);
        if (match) {
          studentWeaknesses = match[0].replace(/specific weaknesses[:\s]*/i, '').trim();
        }
      }
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

  // Answer change
  const handleAnswer = (val: string) => {
    setAnswers((prev) => ({ ...prev, [current]: val }));
  };

  // Submit logic
  const handleSubmit = () => {
    setSubmitted(true);
    setShowSummary(true);
    // TODO: Save answers to Supabase and trigger AI evaluation
  };

  // Navigation
  const next = () => setCurrent((c) => Math.min(c + 1, questions.length - 1));
  const prev = () => setCurrent((c) => Math.max(c - 1, 0));

  // Summary
  const unanswered = questions.filter((_: any, i: number) => !answers[i]);

  // Handle answer sheet upload
  const handleAnswerSheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploading(true);
    try {
      const file = e.target.files?.[0];
      if (!file || !user?.id) throw new Error('No file selected or user not found');
      if (file.type !== 'application/pdf') throw new Error('Only PDF files are supported.');
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/exam_${Date.now()}_${file.name}`;
      const { data, error: uploadError } = await supabase.storage.from('answer-sheets').upload(filePath, file);
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
      if (file.type.startsWith('image/')) {
        // Image OCR
        const { data: { text } } = await Tesseract.recognize(file, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100));
          }
        });
        setExtractedText(text.trim());
      } else if (file.type === 'application/pdf') {
        // PDF: try text extraction, fallback to OCR
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
          // Fallback to OCR for image-based PDFs
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
          setExtractedText(ocrText.trim());
        } else {
          setExtractedText(text.trim());
        }
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
      const prompt = `You are a strict CBSE board examiner. Below is a list of exam questions and a student's handwritten answers (extracted as plain text). The answers may be separated by question numbers like Q1:, Q2:, 1., 2., or may be in order.\n\nYour tasks:\n1. For each question, find the corresponding answer from the student's text (by question number or order).\n2. Evaluate each answer according to the latest CBSE marking scheme and rubrics.\n3. For each question, provide: question_number, marks_awarded, max_marks.\n\nReturn ONLY a valid JSON array, no explanation or extra text. Do NOT wrap the JSON in any Markdown or code block.\n\nQuestions:\n${questionsList}\n\nStudent's answers:\n${extractedText}`;
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
      const prompt = `You are an expert CBSE teacher and exam coach. Based on the following student's answers and the detailed AI evaluation, generate a personalized improvement plan and performance analysis.\n\nYou must:\n- Carefully analyze all questions that were answered incorrectly or only partially correct.\n- Spot the student's weaknesses based on these incorrect/partial answers.\n- Base the improvement plan and recommendations on these weaknesses.\n\nFirst, state the student's total marks out of 80 (e.g., 'Total Marks: 56/80').\n\nThe plan should then include: (1) key strengths, (2) specific weaknesses (with reference to the questions answered incorrectly), (3) actionable steps to improve, (4) recommended resources or study strategies, and (5) a motivational message.\n\nFormat your response in Markdown.\n\nStudent's answers:\n${extractedText}\n\nAI Evaluation (JSON):\n${aiFeedback}`;
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

      // Extract weaknesses section from the improvement plan (markdown)
      let weaknesses = '';
      const match = cleanedText.match(/specific weaknesses[\s\S]*?(?=(\n\n|$))/i);
      if (match) {
        weaknesses = match[0]
          .replace(/specific weaknesses[:\s]*/i, '')
          .replace(/\n/g, ', ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      // Get student name (fallback to email)
      const studentName = user?.full_name || user?.email?.split('@')[0] || 'Student';
      // Get all classes for the student
      const { data: classMemberships } = await supabase
        .from('class_members')
        .select('class_id')
        .eq('user_id', user.id);

      const teacherIds = new Set();

      if (Array.isArray(classMemberships)) {
        for (const membership of classMemberships) {
          const { data: classInfo } = await supabase
            .from('classes')
            .select('teacher_id, subject')
            .eq('id', membership.class_id)
            .single();
          if (classInfo && classInfo.teacher_id) {
            teacherIds.add(classInfo.teacher_id);
          }
        }
      }

      // Save feedback to Supabase and get attempt id
      let attemptId = null;
      if (user?.id && aiFeedback && extractedText) {
        setSaveStatus('saving');
        setSaveError(null);
        try {
          let studentWeaknesses = '';
          if (improvementPlan) {
            console.log('Improvement plan:', improvementPlan);
            const match = improvementPlan.match(/specific weaknesses[\s\S]*?(?:\n\n|$)/i);
            console.log('Regex match:', match);
            if (match) {
              studentWeaknesses = match[0].replace(/specific weaknesses[:\s]*/i, '').trim();
            } else {
              // Fallback: save the whole improvement plan or a default message
              studentWeaknesses = 'No specific weaknesses section found. Full plan:\n' + improvementPlan;
            }
          }
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
          }).select('id').single();
          if (error) throw error;
          attemptId = attemptInsert?.id;
          setSaveStatus('saved');
          if (showToast) showToast('Results saved!', 'success');

          // Send notification to each teacher only after attemptId is available
          console.log('Notification creation debug:', {
            classMemberships,
            studentWeaknesses: !!studentWeaknesses,
            attemptId,
            selectedSubject
          });
          
          if (Array.isArray(classMemberships)) {
            for (const membership of classMemberships) {
              const { data: classInfo } = await supabase
                .from('classes')
                .select('teacher_id, subject')
                .eq('id', membership.class_id)
                .single();
              
              console.log('Class info for notification:', classInfo);
              console.log('Subject comparison:', {
                classSubject: classInfo?.subject,
                selectedSubject,
                matches: classInfo?.subject?.toLowerCase() === selectedSubject.toLowerCase()
              });
              
              if (
                classInfo &&
                classInfo.teacher_id &&
                studentWeaknesses &&
                attemptId &&
                classInfo.subject &&
                classInfo.subject.toLowerCase() === selectedSubject.toLowerCase()
              ) {
                console.log('Creating notification for teacher:', classInfo.teacher_id);
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
                
                if (notificationError) {
                  console.error('Notification creation error:', notificationError);
                } else {
                  console.log('Notification created successfully');
                }
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-gray-900 to-black p-6">
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-blue-800 w-full max-w-2xl animate-fade-in">
          <h2 className="text-2xl font-bold text-blue-400 mb-4 flex items-center gap-2"><CheckCircle className="w-6 h-6 text-green-400" /> Exam Submitted!</h2>
          <div className="mb-4 text-gray-300">Thank you for completing the exam. Your answers have been saved.</div>
          {/* Answer Sheet Upload */}
          <div className="mt-8 p-6 bg-gray-800 rounded-xl border border-blue-700">
            <h3 className="text-lg font-bold text-blue-300 mb-2">Upload Your Handwritten Answer Sheet</h3>
            <p className="text-gray-400 mb-4">Scan or take clear photos of your answer sheets, combine them into a single PDF, and upload the PDF file here. <span className="text-yellow-400 font-semibold">Only PDF files are allowed.</span> This will be used for AI evaluation.</p>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleAnswerSheetUpload}
              className="mb-2"
              disabled={uploading}
            />
            {uploading && <div className="text-blue-400">Uploading...</div>}
            {uploadError && <div className="text-red-400">{uploadError}</div>}
            {uploadedFileUrl && (
              <div className="mt-2 text-green-400">
                Uploaded! <a href={uploadedFileUrl} target="_blank" rel="noopener noreferrer" className="underline">View File</a>
              </div>
            )}
          </div>
          {/* OCR Extracted Text */}
          {uploadedFileUrl && (
            <div className="mt-8 p-6 bg-gray-900 rounded-xl border border-blue-800">
              <h3 className="text-lg font-bold text-blue-200 mb-2">Extracted Text from Answer Sheet</h3>
              {extracting && (
                <div className="text-blue-400 mb-2">Extracting text... {ocrProgress !== null ? `(${ocrProgress}%)` : ''}</div>
              )}
              {extractedText && (
                <textarea
                  className="w-full p-3 rounded bg-gray-800 text-white border border-blue-700"
                  rows={10}
                  value={extractedText}
                  readOnly
                />
              )}
              {!extracting && !extractedText && (
                <div className="text-gray-400">No text extracted yet.</div>
              )}
            </div>
          )}
          {/* AI Evaluation Button and Feedback */}
          {uploadedFileUrl && extractedText && (
            <div className="mt-8 p-6 bg-gray-900 rounded-xl border border-blue-800">
              <h3 className="text-lg font-bold text-blue-200 mb-2">AI Evaluation</h3>
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded shadow transition mb-4"
                onClick={handleEvaluateWithAI}
                disabled={aiLoading}
              >
                {aiLoading ? 'Evaluating...' : 'Evaluate with AI'}
              </button>
              {aiError && <div className="text-red-400 mb-2">{aiError}</div>}
              {/* Raw JSON feedback textarea removed */}
            </div>
          )}
          {/* Structured AI Feedback Report */}
          {aiFeedback && parsedFeedback.length > 0 && (
            <div className="mt-8 p-6 bg-gray-900 rounded-xl border border-green-800">
              <h3 className="text-lg font-bold text-green-300 mb-2">CBSE-Style Report Card</h3>
              <div className="mb-4 text-white font-semibold">Total Score: <span className="text-green-400">{totalScore} / {maxScore}</span></div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-300 mb-4">
                  <thead className="bg-green-900 text-green-200">
                    <tr>
                      <th className="px-3 py-2">Q#</th>
                      <th className="px-3 py-2">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedFeedback.map((q, i) => (
                      <tr key={i} className="border-b border-green-800">
                        <td className="px-3 py-2 font-bold">{q.question_number || i + 1}</td>
                        <td className="px-3 py-2">{q.marks_awarded} / {q.max_marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow transition mt-2"
                onClick={handleSaveResults}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
              >
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Results'}
              </button>
              {saveStatus === 'error' && <div className="text-red-400 mt-2">{saveError}</div>}
              {saveStatus === 'saved' && <div className="text-green-400 mt-2">Results saved successfully!</div>}
            </div>
          )}
          {/* Personalized Improvement Plan */}
          {aiFeedback && (
            <div className="mt-8 p-6 bg-gray-900 rounded-xl border border-blue-800">
              <h3 className="text-lg font-bold text-blue-200 mb-2">Personalized Improvement Plan</h3>
              <button
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded shadow transition mb-4"
                onClick={handleGenerateImprovementPlan}
                disabled={planLoading}
              >
                {planLoading ? 'Generating...' : 'Generate Improvement Plan'}
              </button>
              {planError && <div className="text-red-400 mb-2">{planError}</div>}
              {improvementPlan && (
                <div
                  className="w-full p-3 rounded bg-gray-800 text-white border border-purple-700 prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: marked(improvementPlan) as string }}
                />
              )}
            </div>
          )}
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow transition mt-8" onClick={() => setShowSummary(false)}>Review Answers</button>
        </div>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-gray-900 to-black p-6">
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-blue-800 w-full max-w-2xl animate-fade-in text-center">
          <h2 className="text-2xl font-bold text-blue-400 mb-4">No Questions Found</h2>
          <div className="mb-6 text-gray-300">No questions were provided for this exam session. Please generate a paper in the CBSE Exam Simulator first.</div>
          <a href="/cbse-simulator" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow transition">Go to CBSE Simulator</a>
        </div>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-gray-900 to-black p-6">
      <div className="w-full max-w-2xl bg-gray-900 rounded-2xl shadow-2xl p-8 border border-blue-800 animate-fade-in relative">
        {/* Timer */}
        <div className="absolute top-6 right-8 flex items-center gap-2 text-yellow-300 font-mono text-lg">
          <Clock className="w-5 h-5" /> {formatTime(timeLeft)}
        </div>
        {/* Progress */}
        <div className="mb-6 flex items-center gap-2 text-blue-400 font-semibold">
          Question {current + 1} of {questions.length}
        </div>
        {/* Question Card */}
        <div className="bg-gradient-to-r from-blue-950 via-gray-900 to-black rounded-xl p-6 shadow mb-6 animate-fade-in">
          <div className="flex items-center gap-4 mb-2">
            <span className="bg-blue-700 text-white px-3 py-1 rounded-full text-xs font-bold tracking-widest shadow">Section {q.section}</span>
            <span className="bg-gray-700 text-blue-200 px-2 py-1 rounded text-xs uppercase tracking-wide">{q.type}</span>
            <span className="ml-auto text-yellow-400 font-bold">[{q.marks} mark{q.marks > 1 ? 's' : ''}]</span>
          </div>
          <div className="text-white text-lg font-medium pl-2 border-l-4 border-blue-600 mb-4">{q.question}</div>
          {/* Answer Input Removed: Only use uploaded answer sheets */}
        </div>
        {/* Navigation Buttons Restored */}
        <div className="flex justify-between items-center mt-4">
          <button
            className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded shadow transition disabled:opacity-50"
            onClick={prev}
            disabled={current === 0}
          >
            <ArrowLeft className="w-5 h-5 inline mr-2" /> Previous
          </button>
          {current < questions.length - 1 ? (
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow transition"
              onClick={next}
            >
              Next <ArrowRight className="w-5 h-5 inline ml-2" />
            </button>
          ) : (
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded shadow transition"
              onClick={handleSubmit}
            >
              Submit <CheckCircle className="w-5 h-5 inline ml-2" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CBSEExamSession; 