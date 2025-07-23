import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, ChevronRight, CheckCircle, FileText, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const CLASS10_SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'Social Science',
  'Hindi',
  'Sanskrit',
  'Information Technology',
  'Home Science',
  'Computer Applications',
];

const CLASS12_SUBJECTS = {
  Science: [
    'Physics',
    'Chemistry',
    'Mathematics',
    'Biology',
    'English',
    'Computer Science',
    'Physical Education',
    'Informatics Practices',
  ],
  Commerce: [
    'Accountancy',
    'Business Studies',
    'Economics',
    'Mathematics',
    'English',
    'Informatics Practices',
    'Physical Education',
  ],
  Humanities: [
    'History',
    'Geography',
    'Political Science',
    'Economics',
    'Psychology',
    'Sociology',
    'English',
    'Mathematics',
    'Physical Education',
  ],
};
const CLASSES = ['10', '12'];
const EXAM_TYPES = ['Board', 'Pre-Board', 'Practice'];
// AI-powered chapter fetching
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
async function fetchChaptersWithAI(subject: string, classLevel: string) {
  const prompt = `List all chapters for CBSE Class ${classLevel} ${subject} as per the latest official syllabus. For each chapter, include: name, estimated weightage (marks), and the main learning outcome (CLO). Return ONLY a valid JSON array, no explanation or extra text. Each item should have fields: name, weightage, clo.`;
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
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON array from the text
    const match = text.match(/\[.*\]/s);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    throw new Error('Failed to parse chapters from AI. Raw response: ' + text);
  }
}
const SECTION_TYPES = [
  { label: 'MCQ', value: 'mcq' },
  { label: 'Short Answer', value: 'short' },
  { label: 'Long Answer', value: 'long' },
];

const STEPS = [
  { label: 'Exam Details', icon: BookOpen },
  { label: 'Chapters & Settings', icon: FileText },
  { label: 'Preview & Generate', icon: Zap },
];

interface GeminiQuestionGenParams {
  subject: string;
  classLevel: string;
  chapters: string[];
  examType: string;
  difficulty: string;
  numQuestions: number;
  sectionTypes: string[];
}

async function generateQuestionsWithGemini({ subject, classLevel, chapters, examType, difficulty, sectionTypes }: Omit<GeminiQuestionGenParams, 'numQuestions'>) {
  const pyqMainPage = 'https://www.cbse.gov.in/cbsenew/question-paper.html';
  const prompt = `Generate a CBSE-style question paper for Class ${classLevel} ${subject} (${examType} Exam), following the latest CBSE syllabus.\n\nFirst, try to analyze the pattern, section structure, and question types from all available previous year CBSE question papers accessible from the official CBSE PYQ page: ${pyqMainPage} for both class 10 and 12.\n\nIf you cannot access that page or its contents, search the entire internet for previous year CBSE question papers and use their patterns, sectioning, and question types as reference.\n\nThe total marks for the paper MUST be exactly 80. The sum of all question marks must be exactly 80 and must NOT exceed 80 under any circumstances. The total number of questions should be at least 30 and not more than 37, as per the latest CBSE pattern for this subject and class. Match the distribution of marks, question types (MCQ, short, long), and chapter weightage as seen in real CBSE board exams.\n\nUse only these chapters: ${chapters.join(", ")}. Distribute questions across these section types: ${sectionTypes.join(", ")}.\n\nFor each question, provide: section, type, marks, and question text. Return ONLY a valid JSON array, no explanation or extra text. Do NOT wrap the JSON in any Markdown or code block. Each item should have fields: section, type, marks, question.`;

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
  // Gemini returns text in data.candidates[0].content.parts[0].text
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  // Try to parse JSON from the response
  let cleanText = text.trim();
  // Remove Markdown code block markers (```json, ```, '''json, ''')
  cleanText = cleanText.replace(/^(```json|```|'''json|''')/i, '').replace(/(```|''')$/i, '').trim();
  try {
    const questions = JSON.parse(cleanText);
    return questions;
  } catch (e) {
    // Try to extract JSON array from the text
    const match = cleanText.match(/\[.*\]/s);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    throw new Error('Failed to parse Gemini response: ' + text);
  }
}

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

const TABS = ['Exam Simulator', 'Saved Results'];

const CBSEExamSimulator: React.FC = () => {
  const [step, setStep] = useState(1);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [examType, setExamType] = useState('');
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState('Medium');
  const [numQuestions, setNumQuestions] = useState(10);
  const [selectedSections, setSelectedSections] = useState<string[]>(SECTION_TYPES.map(s => s.value));
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const navigate = useNavigate();
  const [selectedStream, setSelectedStream] = useState<keyof typeof CLASS12_SUBJECTS>('Science');
  const [aiChapters, setAiChapters] = useState<{ name: string; weightage: number; clo: string }[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [chaptersError, setChaptersError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth() as any;
  const [activeTab, setActiveTab] = useState('Exam Simulator');
  const [savedResults, setSavedResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'Saved Results' && user) {
      setResultsLoading(true);
      setResultsError(null);
      supabase
        .from('cbse_exam_attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('exam_date', { ascending: false })
        .then(({ data, error }) => {
          if (error) setResultsError(error.message);
          else setSavedResults(data || []);
          setResultsLoading(false);
        });
    }
  }, [activeTab, user]);

  const handleExportPDF = async () => {
    if (!previewRef.current) return;
    const element = previewRef.current;
    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    let imgHeight = (canvas.height * pdfWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }
    pdf.save(`CBSE_Question_Paper_${selectedSubject}_Class${selectedClass}.pdf`);
  };

  // Helper for select all chapters
  const allChapterNames = aiChapters.map(ch => ch.name);
  const allSelected = allChapterNames.length > 0 && allChapterNames.every(name => selectedChapters.includes(name));
  const handleSelectAllChapters = (checked: boolean) => {
    if (checked) setSelectedChapters(allChapterNames);
    else setSelectedChapters([]);
  };

  // Fetch chapters when subject/class changes
  useEffect(() => {
    if (!selectedSubject || !selectedClass) {
      setAiChapters([]);
      setChaptersError(null);
      return;
    }
    setChaptersLoading(true);
    setChaptersError(null);
    fetchChaptersWithAI(selectedSubject, selectedClass)
      .then(chapters => setAiChapters(Array.isArray(chapters) ? chapters : []))
      .catch(err => setChaptersError(err.message || 'Failed to fetch chapters'))
      .finally(() => setChaptersLoading(false));
  }, [selectedSubject, selectedClass]);

  const renderProgress = () => (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((stepObj, idx) => (
        <div key={stepObj.label} className="flex items-center">
          <div className={`flex flex-col items-center ${step > idx + 1 ? 'text-green-400' : step === idx + 1 ? 'text-blue-500' : 'text-gray-400'}`}>
            <stepObj.icon className="w-7 h-7 mb-1" />
            <span className="text-xs font-semibold">{stepObj.label}</span>
          </div>
          {idx < STEPS.length - 1 && (
            <ChevronRight className="mx-3 w-5 h-5 text-gray-500" />
          )}
        </div>
      ))}
    </div>
  );

  // Step 1: Select subject, class, exam type
  const renderStep1 = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-blue-500 mb-2">CBSE Exam Simulator</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block mb-1 font-semibold">Class</label>
          <select
            className="w-full p-2 rounded border bg-gray-900 text-white"
            value={selectedClass}
            onChange={e => {
              setSelectedClass(e.target.value);
              setSelectedSubject('');
            }}
          >
            <option value="">Select Class</option>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {selectedClass === '12' && (
          <div>
            <label className="block mb-1 font-semibold">Stream</label>
            <select
              className="w-full p-2 rounded border bg-gray-900 text-white"
              value={selectedStream}
              onChange={e => {
                setSelectedStream(e.target.value as keyof typeof CLASS12_SUBJECTS);
                setSelectedSubject('');
              }}
            >
              {Object.keys(CLASS12_SUBJECTS).map(stream => (
                <option key={stream} value={stream}>{stream}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block mb-1 font-semibold">Subject</label>
          <select
            className="w-full p-2 rounded border bg-gray-900 text-white"
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
            disabled={!selectedClass}
          >
            <option value="">Select Subject</option>
            {selectedClass === '10' && CLASS10_SUBJECTS.map((s: string) => <option key={s} value={s}>{s}</option>)}
            {selectedClass === '12' && CLASS12_SUBJECTS[selectedStream].map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-semibold">Exam Type</label>
          <select
            className="w-full p-2 rounded border bg-gray-900 text-white"
            value={examType}
            onChange={e => setExamType(e.target.value)}
          >
            <option value="">Select Type</option>
            {EXAM_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>
      <button
        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow transition disabled:opacity-50"
        disabled={!selectedSubject || !selectedClass || !examType}
        onClick={() => setStep(2)}
      >
        Next: Choose Chapters
      </button>
    </div>
  );

  // Step 2: Select chapters, difficulty, sections, number of questions
  const renderStep2 = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-blue-400 mb-2">Select Chapters & Exam Settings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-1 font-semibold">Chapters (with weightage)</label>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {aiChapters.length > 0 && (
              <label className="flex items-center gap-2 bg-blue-950 rounded p-2 cursor-pointer mb-2 border border-blue-800">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => handleSelectAllChapters(e.target.checked)}
                />
                <span className="font-semibold text-blue-200">Select All Chapters</span>
              </label>
            )}
            {chaptersLoading && <div className="text-blue-400">Loading chapters...</div>}
            {chaptersError && <div className="text-red-400">{chaptersError}</div>}
            {!chaptersLoading && !chaptersError && aiChapters.length === 0 && (
              <div className="text-gray-400">Select a subject and class to load chapters.</div>
            )}
            {aiChapters.map(ch => (
              <label key={ch.name} className="flex items-center gap-2 bg-gray-800 rounded p-2 cursor-pointer hover:bg-blue-900 transition">
                <input
                  type="checkbox"
                  checked={selectedChapters.includes(ch.name)}
                  onChange={e => {
                    if (e.target.checked) setSelectedChapters([...selectedChapters, ch.name]);
                    else setSelectedChapters(selectedChapters.filter(c => c !== ch.name));
                  }}
                />
                <span className="font-semibold text-white">{ch.name}</span>
                <span className="ml-auto text-xs text-blue-300">{ch.weightage} marks</span>
                <span className="ml-2 text-xs text-gray-400">({ch.clo})</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block mb-1 font-semibold">Difficulty</label>
            <select
              className="w-full p-2 rounded border bg-gray-900 text-white"
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
            >
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </div>
          {/* Number of Questions input removed: AI will decide based on CBSE pattern and 80 marks */}
          <div>
            <label className="block mb-1 font-semibold">Section Types</label>
            <div className="flex gap-4">
              {SECTION_TYPES.map(s => (
                <label key={s.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedSections.includes(s.value)}
                    onChange={e => {
                      if (e.target.checked) setSelectedSections([...selectedSections, s.value]);
                      else setSelectedSections(selectedSections.filter(sec => sec !== s.value));
                    }}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-4 mt-6">
        <button
          className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded shadow transition"
          onClick={() => setStep(1)}
        >
          Back
        </button>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow transition disabled:opacity-50"
          disabled={selectedChapters.length === 0}
          onClick={() => setStep(3)}
        >
          Next: Generate Paper
        </button>
      </div>
    </div>
  );

  // Step 3: Generate and preview paper
  const renderStep3 = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-blue-400 mb-2">Preview Question Paper</h2>
      <div ref={previewRef} className="bg-gray-800 rounded-xl p-6 shadow-lg border border-blue-700">
        <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-semibold text-white">{selectedSubject} - Class {selectedClass} ({examType} Exam)</div>
            <div className="text-sm text-gray-400">Chapters: {selectedChapters.join(', ')}</div>
            <div className="text-sm text-gray-400">Difficulty: {difficulty} | Sections: {selectedSections.join(', ')} | Total Questions: {questions.length}</div>
          </div>
        </div>
        {questions.length > 0 ? questions.map((q, i) => (
          <div key={i} className="py-6 px-2 bg-gradient-to-r from-blue-950 via-gray-900 to-black rounded-xl mb-4 shadow-md animate-fade-in">
            <div className="flex items-center gap-4 mb-2">
              <span className="bg-blue-700 text-white px-3 py-1 rounded-full text-xs font-bold tracking-widest shadow">Section {q.section}</span>
              <span className="bg-gray-700 text-blue-200 px-2 py-1 rounded text-xs uppercase tracking-wide">{q.type}</span>
              <span className="ml-auto text-yellow-400 font-bold">[{q.marks} mark{q.marks > 1 ? 's' : ''}]</span>
            </div>
            <div className="text-white text-lg font-medium pl-2 border-l-4 border-blue-600 question-math">
              {i + 1}. {parseMathInline(q.question)}
            </div>
          </div>
        )) : (
          <div className="text-center text-gray-400 py-8">
            No questions generated yet. Click "Generate with AI" to create a CBSE-style question paper.
          </div>
        )}
      </div>
      <button
        className="mt-4 md:mt-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow transition"
        onClick={handleExportPDF}
      >
        Export as PDF
      </button>
      <button
        className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded shadow transition"
        onClick={() => setStep(2)}
      >
        Back
      </button>
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow transition"
        onClick={() => navigate('/cbse-exam-session', { state: { questions } })}
        disabled={questions.length === 0}
      >
        Start Exam
      </button>
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow transition"
        onClick={async () => {
          setGenerating(true);
          setQuestions([]);
          try {
            const aiQuestions = await generateQuestionsWithGemini({
              subject: selectedSubject,
              classLevel: selectedClass,
              chapters: selectedChapters,
              examType,
              difficulty,
              sectionTypes: selectedSections,
            });
            // Enforce total marks <= 80 by truncating
            function truncateTo80Marks(questions: any[]) {
              let sum = 0;
              const result = [];
              for (const q of questions) {
                if (sum + q.marks <= 80) {
                  result.push(q);
                  sum += q.marks;
                } else {
                  // Optionally, add a partial question to reach exactly 80
                  if (sum < 80) {
                    const remaining = 80 - sum;
                    if (remaining > 0) {
                      result.push({ ...q, marks: remaining });
                    }
                  }
                  break;
                }
              }
              return result;
            }
            setQuestions(truncateTo80Marks(aiQuestions));
          } catch (err) {
            alert('AI generation failed: ' + err);
          }
          setGenerating(false);
        }}
        disabled={generating}
      >
        {generating ? 'Generating...' : 'Generate with AI'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 p-6 flex flex-col items-center justify-center relative">
      <div className="w-full max-w-4xl mx-auto bg-gray-900 rounded-2xl shadow-2xl p-8 border border-blue-800 animate-fade-in">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-blue-800">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`px-4 py-2 font-semibold focus:outline-none transition-colors duration-200 ${activeTab === tab ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        {/* Tab Content */}
        {activeTab === 'Exam Simulator' && (
          <>
            {renderProgress()}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </>
        )}
        {activeTab === 'Saved Results' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-blue-400 mb-4">Saved Results</h2>
            {resultsLoading ? (
              <div className="text-blue-400">Loading...</div>
            ) : resultsError ? (
              <div className="text-red-400">{resultsError}</div>
            ) : savedResults.length === 0 ? (
              <div className="text-gray-400">No saved results found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-300 mb-4">
                  <thead className="bg-blue-900 text-blue-200">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Class</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Sheet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedResults.map((r, i) => (
                      <tr key={r.id || i} className="border-b border-blue-800">
                        <td className="px-3 py-2">{r.exam_date ? new Date(r.exam_date).toLocaleString() : ''}</td>
                        <td className="px-3 py-2">{r.subject || '-'}</td>
                        <td className="px-3 py-2">{r.class_level || '-'}</td>
                        <td className="px-3 py-2">{r.total_score} / {r.max_score}</td>
                        <td className="px-3 py-2">{r.answer_sheet_url && <a href={r.answer_sheet_url} target="_blank" rel="noopener noreferrer" className="underline text-blue-400">View</a>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CBSEExamSimulator; 