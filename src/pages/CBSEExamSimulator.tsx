import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, ChevronRight, CheckCircle, FileText, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import OpenAIService from '../lib/openaiService';

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
// Add subject/class to total marks mapping
export const SUBJECT_TOTAL_MARKS: Record<string, number> = {
  // --- Class 10 ---
  '10 English Language & Literature': 80,
  '10 Hindi Course A': 80,
  '10 Hindi Course B': 80,
  '10 Mathematics': 80,
  '10 Science': 80,
  '10 Social Science': 80,
  '10 Information Technology': 50,
  '10 Artificial Intelligence': 50,
  // Add other skill/optional subjects as needed

  // --- Class 12 Science ---
  '12 Physics': 70,
  '12 Chemistry': 70,
  '12 Biology': 70,
  '12 Mathematics': 80,
  '12 Computer Science': 70,
  '12 Informatics Practices': 70,
  '12 English Core': 80,

  // --- Class 12 Commerce ---
  '12 Accountancy': 80,
  '12 Business Studies': 80,
  '12 Economics': 80,
  '12 Applied Mathematics': 80,
  '12 Entrepreneurship': 70,

  // --- Class 12 Humanities ---
  '12 History': 80,
  '12 Geography': 70,
  '12 Political Science': 80,
  '12 Sociology': 80,
  '12 Psychology': 70,
  '12 Physical Education': 70,
  // Add Fine Arts, Music, Dance, etc. as needed
};
// Add subject-specific expected unit counts
const SUBJECT_EXPECTED_UNITS: Record<string, { min: number; max: number }> = {
  // Class 10
  '10 Mathematics': { min: 6, max: 8 },
  '10 Science': { min: 5, max: 7 },
  '10 English Language & Literature': { min: 4, max: 6 },
  '10 Social Science': { min: 4, max: 6 },
  '10 Hindi Course A': { min: 4, max: 6 },
  '10 Hindi Course B': { min: 4, max: 6 },
  
  // Class 12 Science
  '12 Physics': { min: 9, max: 10 },
  '12 Chemistry': { min: 9, max: 10 },
  '12 Biology': { min: 8, max: 10 },
  '12 Mathematics': { min: 6, max: 8 },
  '12 Computer Science': { min: 4, max: 6 },
  '12 Informatics Practices': { min: 4, max: 6 },
  '12 English Core': { min: 3, max: 5 },
  
  // Class 12 Commerce
  '12 Accountancy': { min: 4, max: 6 },
  '12 Business Studies': { min: 4, max: 6 },
  '12 Economics': { min: 4, max: 6 },
  '12 Applied Mathematics': { min: 6, max: 8 },
  
  // Class 12 Humanities
  '12 History': { min: 4, max: 6 },
  '12 Geography': { min: 4, max: 6 },
  '12 Political Science': { min: 4, max: 6 },
  '12 Sociology': { min: 4, max: 6 },
  '12 Psychology': { min: 4, max: 6 },
  '12 Physical Education': { min: 4, max: 6 },
};

async function fetchChaptersWithAI(subject: string, classLevel: string) {
  const officialTotalMarks = SUBJECT_TOTAL_MARKS[`${classLevel} ${subject}`] || 80;
  const expectedUnits = SUBJECT_EXPECTED_UNITS[`${classLevel} ${subject}`] || { min: 4, max: 8 };
  
  // First check if syllabus exists in database
  try {
    const { data: savedSyllabus, error } = await supabase
      .from('cbse_syllabi')
      .select('syllabus_data')
      .eq('subject', subject)
      .eq('class_level', classLevel)
      .single();
    
    if (!error && savedSyllabus?.syllabus_data) {
      console.log('Using saved syllabus from database');
      return savedSyllabus.syllabus_data;
    }
  } catch (error) {
    console.log('No saved syllabus found, fetching from AI...');
  }
  
  const prompt = `Carefully follow the official CBSE syllabus structure for Class ${classLevel} ${subject} from https://cbseacademic.nic.in/curriculum_2026.html.
For each unit (as shown in the official table), provide:
- unit (string): exact name as in the syllabus (e.g., "Unit–I Electrostatics")
- weightage (number): official marks for the unit/group (e.g., 16)
- chapters: a list of chapters in this unit, each with:
  - name (string): exact chapter name as in the syllabus (e.g., "Chapter–1: Electric Charges and Fields")
  - clo (main learning outcome, if available; otherwise leave blank)
Do not merge, split, omit, invent, or rename any units or chapters. Do not change the marks. The sum of all unit weightages must be ${officialTotalMarks}.
Return ONLY a valid JSON array, no explanation or extra text.`;
  
  const openai = OpenAIService.getInstance();
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      const text = await openai.generateChatCompletion(prompt);
      const chapters = JSON.parse(text);
      
      // Check if syllabus is complete based on subject-specific expectations
      if (Array.isArray(chapters) && chapters.length >= expectedUnits.min && chapters.length <= expectedUnits.max) {
        return chapters;
      } else {
        console.log(`Attempt ${attempts + 1}: Incomplete syllabus (${chapters.length} units, expected ${expectedUnits.min}-${expectedUnits.max}). Retrying...`);
        attempts++;
        if (attempts >= maxAttempts) {
          console.warn(`Failed to get complete syllabus after ${maxAttempts} attempts. Returning partial syllabus (${chapters.length} units).`);
          return chapters;
        }
      }
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error(`Failed to fetch chapters after ${maxAttempts} attempts: ${error}`);
      }
      console.log(`Attempt ${attempts} failed, retrying...`);
    }
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

// Add Gemini-based question generation
async function generateQuestionsWithGemini({ subject, classLevel, chapters, examType, difficulty, sectionTypes }: Omit<GeminiQuestionGenParams, 'numQuestions'>) {
  const totalMarks = SUBJECT_TOTAL_MARKS[`${classLevel} ${subject}`] || 80;
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const prompt = `Refer to the official CBSE previous year question papers and the latest syllabus for the academic year 2025-26 at https://cbseacademic.nic.in/curriculum_2026.html for Class ${classLevel} ${subject}.
Search for the typical number and distribution of each question type (e.g., how many MCQs, short answer, long answer, etc.) in real CBSE board papers for this subject/class. Match the real CBSE pattern for the number of each question type and their marks, using the latest available data from previous year papers and the official CBSE pattern.

The total number of questions MUST be between 33 and 37, as per the latest CBSE board exam pattern for this subject. Do not generate fewer than 33 or more than 37 questions.

Generate a CBSE-style question paper for Class ${classLevel} ${subject} (${examType} Exam), following the latest CBSE syllabus and matching the real distribution of marks, question types, and chapter weightage as seen in actual CBSE board exams.

The total marks for the paper MUST be exactly ${totalMarks}. The sum of all question marks must be exactly ${totalMarks} and must NOT exceed ${totalMarks} under any circumstances.

Use only these chapters: ${chapters.join(", ")}. Distribute questions across these section types: ${sectionTypes.join(", ")}. For each question, provide: section, type, marks, and question text. Return ONLY a valid JSON array, no explanation or extra text. Do NOT wrap the JSON in any Markdown or code block. Each item should have fields: section, type, marks, question.`;
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
  let cleanText = text.trim();
  cleanText = cleanText.replace(/^(```json|```|'''json|''')/i, '').replace(/(```|''')$/i, '').trim();
  try {
    const questions = JSON.parse(cleanText);
    if (Array.isArray(questions) && (questions.length < 33 || questions.length > 37)) {
      alert('AI did not generate the correct number of questions (33-37). Please try again.');
    }
    return questions;
  } catch (e) {
    const match = cleanText.match(/\[.*\]/s);
    if (match) {
      try {
        const questions = JSON.parse(match[0]);
        if (Array.isArray(questions) && (questions.length < 33 || questions.length > 37)) {
          alert('AI did not generate the correct number of questions (33-37). Please try again.');
        }
        return questions;
      } catch {}
    }
    throw new Error('Failed to parse Gemini response: ' + text);
  }
}

// Add/replace feedback and evaluation logic to use OpenAI
async function evaluateAnswersWithOpenAI({ answers, questions, subject, classLevel }: { answers: string[]; questions: any[]; subject: string; classLevel: string }) {
  const openai = OpenAIService.getInstance();
  const prompt = `You are an expert CBSE board examiner for Class ${classLevel} ${subject}. Given the following student answers and the official questions, evaluate each answer thoroughly according to the latest CBSE marking scheme and answer key style. For each answer, provide:
- A score (out of the question's marks)
- Detailed, constructive feedback (point out strengths, mistakes, and how to improve)
- Reference to the marking scheme if possible

Questions:
${JSON.stringify(questions, null, 2)}

Student Answers:
${JSON.stringify(answers, null, 2)}

Return ONLY a valid JSON array, where each item has: questionIndex, score, feedback.`;
  const text = await openai.generateChatCompletion(prompt);
  try {
    const feedback = JSON.parse(text);
    return feedback;
  } catch {
    const match = text.match(/\[.*\]/s);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    throw new Error('Failed to parse OpenAI feedback response: ' + text);
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

const TABS = ['Exam Simulator', 'Saved Results', 'Dev'];

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
  // Update aiChapters state type for 3-level hierarchy
  const [aiChapters, setAiChapters] = useState<{
    unit: string;
    weightage: number;
    subunits?: { subunit: string; chapters: { name: string; clo: string }[] }[];
    chapters?: { name: string; clo: string }[];
  }[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [chaptersError, setChaptersError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth() as any;
  const [activeTab, setActiveTab] = useState('Exam Simulator');
  const [savedResults, setSavedResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  
  // Dev tab state
  const [devSubject, setDevSubject] = useState('');
  const [devClass, setDevClass] = useState('');
  const [devStream, setDevStream] = useState<keyof typeof CLASS12_SUBJECTS>('Science');
  const [devSyllabus, setDevSyllabus] = useState<any[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const [devSuccess, setDevSuccess] = useState<string | null>(null);
  const [savedSyllabi, setSavedSyllabi] = useState<any[]>([]);
  const [syllabiLoading, setSyllabiLoading] = useState(false);
  
  // Manual syllabus entry state
  const [manualSyllabusText, setManualSyllabusText] = useState('');
  const [manualSyllabusLoading, setManualSyllabusLoading] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

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

  // Load saved syllabi for dev tab
  useEffect(() => {
    if (activeTab === 'Dev') {
      setSyllabiLoading(true);
      supabase
        .from('cbse_syllabi')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) console.error('Error loading syllabi:', error);
          else setSavedSyllabi(data || []);
          setSyllabiLoading(false);
        });
    } else {
      // Clear dev tab state when switching away
      setDevSubject('');
      setDevClass('');
      setDevStream('Science');
      setDevSyllabus([]);
      setDevError(null);
      setDevSuccess(null);
      setManualSyllabusText('');
      setShowManualEntry(false);
    }
  }, [activeTab]);

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

  // Helper for select all chapters (now works with 3-level structure)
  const allChapterNames = aiChapters.flatMap(unit => [
    ...(unit.chapters ? unit.chapters.map(ch => ch.name) : []),
    ...(unit.subunits ? unit.subunits.flatMap(su => su.chapters.map(ch => ch.name)) : []),
  ]);
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
            disabled={!selectedClass || (selectedClass === '12' && !selectedStream)}
          >
            <option value="">Select Subject</option>
            {selectedClass === '10' && CLASS10_SUBJECTS.map((s: string) => <option key={s} value={s}>{s}</option>)}
            {selectedClass === '12' && selectedStream && CLASS12_SUBJECTS[selectedStream] && CLASS12_SUBJECTS[selectedStream].map((s: string) => <option key={s} value={s}>{s}</option>)}
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
            {aiChapters.length > 0 && (
              <div className="text-xs text-blue-300 mb-2">
                <span>Note: Only group/unit weightage is official. Chapter weightage is not provided by CBSE.</span><br />
                <span className="text-yellow-300">This simulator generates the theory paper only. Practical/Internal Assessment marks are not included.</span>
              </div>
            )}
            {chaptersLoading && <div className="text-blue-400">Loading chapters...</div>}
            {chaptersError && <div className="text-red-400">{chaptersError}</div>}
            {!chaptersLoading && !chaptersError && aiChapters.length === 0 && (
              <div className="text-gray-400">Select a subject and class to load chapters.</div>
            )}
            {aiChapters.map(unit => (
              <div key={unit.unit} className="mb-3 bg-gray-900 rounded-lg border border-blue-900 p-2">
                <div className="flex items-center mb-1">
                  <span className="font-bold text-blue-400 text-base mr-2">{unit.unit}</span>
                  {/* Weightage removed */}
                </div>
                {/* Chapters directly under unit */}
                {unit.chapters && unit.chapters.length > 0 && (
                  <div className="space-y-1 ml-4">
                    {unit.chapters.map(ch => (
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
                        <span className="ml-2 text-xs text-gray-400">({ch.clo})</span>
                      </label>
                    ))}
                  </div>
                )}
                {/* Subunits and their chapters */}
                {unit.subunits && unit.subunits.length > 0 && (
                  <div className="ml-4">
                    {unit.subunits.map(su => (
                      <div key={su.subunit} className="mb-2">
                        <div className="font-semibold text-blue-300 mb-1">{su.subunit}</div>
                        <div className="space-y-1 ml-4">
                          {su.chapters.map(ch => (
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
                <span className="ml-2 text-xs text-gray-400">({ch.clo})</span>
              </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
            const totalMarks = SUBJECT_TOTAL_MARKS[`${selectedClass} ${selectedSubject}`] || 80;
            setQuestions(adjustToTotalMarks(aiQuestions, totalMarks));
          } catch (err) {
            alert('AI generation failed: ' + err);
          }
          setGenerating(false);
        }}
        disabled={generating}
      >
        {generating ? 'Generating...' : 'Generate with AI'}
      </button>
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow transition"
        onClick={() => navigate('/cbse-exam-session', { state: { questions } })}
        disabled={questions.length === 0}
      >
        Start Exam
      </button>
    </div>
  );

  function adjustToTotalMarks(questions: any[], totalMarks: number) {
    let sum = 0;
    const result = [];
    for (const q of questions) {
      if (sum + q.marks < totalMarks) {
        result.push(q);
        sum += q.marks;
      } else if (sum + q.marks === totalMarks) {
        result.push(q);
        sum += q.marks;
        break;
      } else {
        // Optionally, add a partial question to reach exactly totalMarks
        const remaining = totalMarks - sum;
        if (remaining > 0) {
          result.push({ ...q, marks: remaining });
          sum += remaining;
        }
        break;
      }
    }
    if (sum !== totalMarks) {
      alert(`AI did not generate questions summing to exactly ${totalMarks} marks. Please try again.`);
    }
    return result;
  }

  // Dev tab functions
  const handleFetchSyllabus = async () => {
    if (!devSubject || !devClass) return;
    setDevLoading(true);
    setDevError(null);
    setDevSuccess(null);
    try {
      const syllabus = await fetchChaptersWithAI(devSubject, devClass);
      setDevSyllabus(syllabus);
      setDevSuccess('Syllabus fetched successfully!');
    } catch (error: any) {
      setDevError(error.message || 'Failed to fetch syllabus');
      setDevSuccess(null);
    }
    setDevLoading(false);
  };

  const handleSaveSyllabus = async () => {
    if (!devSyllabus.length || !devSubject || !devClass) return;
    try {
      const totalMarks = SUBJECT_TOTAL_MARKS[`${devClass} ${devSubject}`] || 80;
      const { error } = await supabase
        .from('cbse_syllabi')
        .upsert({
          subject: devSubject,
          class_level: devClass,
          syllabus_data: devSyllabus,
          total_marks: totalMarks,
          units_count: devSyllabus.length
        }, {
          onConflict: 'subject,class_level'
        });
      if (error) throw error;
      // Refresh saved syllabi
      const { data } = await supabase
        .from('cbse_syllabi')
        .select('*')
        .order('created_at', { ascending: false });
      setSavedSyllabi(data || []);
      setDevSuccess('Syllabus saved successfully!');
      setDevError(null);
    } catch (error: any) {
      setDevError('Failed to save syllabus: ' + error.message);
      setDevSuccess(null);
    }
  };

  const handleLoadSyllabus = async (syllabus: any) => {
    setDevSubject(syllabus.subject);
    setDevClass(syllabus.class_level);
    // Set the stream for Class 12 subjects
    if (syllabus.class_level === '12') {
      // Find which stream this subject belongs to
      for (const [stream, subjects] of Object.entries(CLASS12_SUBJECTS)) {
        if (subjects.includes(syllabus.subject)) {
          setDevStream(stream as keyof typeof CLASS12_SUBJECTS);
          break;
        }
      }
    }
    setDevSyllabus(syllabus.syllabus_data);
    setDevSuccess(`Loaded syllabus for ${syllabus.subject} - Class ${syllabus.class_level}`);
    setDevError(null);
  };

  const handleDeleteSyllabus = async (id: string) => {
    if (!confirm('Are you sure you want to delete this syllabus?')) return;
    try {
      const { error } = await supabase
        .from('cbse_syllabi')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setSavedSyllabi(savedSyllabi.filter(s => s.id !== id));
      setDevSuccess('Syllabus deleted successfully!');
      setDevError(null);
    } catch (error: any) {
      setDevError('Failed to delete syllabus: ' + error.message);
      setDevSuccess(null);
    }
  };

  const handleParseManualSyllabus = async () => {
    if (!manualSyllabusText.trim() || !devSubject || !devClass) return;
    
    setManualSyllabusLoading(true);
    setDevError(null);
    setDevSuccess(null);
    
    try {
      const officialTotalMarks = SUBJECT_TOTAL_MARKS[`${devClass} ${devSubject}`] || 80;
      const expectedUnits = SUBJECT_EXPECTED_UNITS[`${devClass} ${devSubject}`] || { min: 4, max: 8 };
      
      const prompt = `Parse the following CBSE syllabus text for Class ${devClass} ${devSubject} and convert it into a structured JSON format.

Syllabus Text:
${manualSyllabusText}

Instructions:
1. Extract all units and their weightage from the provided text
2. For each unit, identify all chapters and their learning outcomes
3. Ensure the sum of all unit weightages equals ${officialTotalMarks}
4. Follow the exact format: unit name, weightage, and chapters with name and clo
5. Do not invent or add any information not present in the text
6. If weightage is not mentioned, estimate based on CBSE patterns

Return ONLY a valid JSON array with this structure:
[
  {
    "unit": "Unit–I [Unit Name]",
    "weightage": [number],
    "chapters": [
      {
        "name": "Chapter–1: [Chapter Name]",
        "clo": "[Learning Outcome]"
      }
    ]
  }
]

Return ONLY the JSON array, no explanation or extra text.`;
      
      const openai = OpenAIService.getInstance();
      const text = await openai.generateChatCompletion(prompt);
      const parsedSyllabus = JSON.parse(text);
      
      if (Array.isArray(parsedSyllabus)) {
        setDevSyllabus(parsedSyllabus);
        setDevSuccess('Manual syllabus parsed successfully!');
        setShowManualEntry(false);
        setManualSyllabusText('');
      } else {
        throw new Error('Invalid syllabus format returned by AI');
      }
    } catch (error: any) {
      setDevError('Failed to parse manual syllabus: ' + error.message);
      setDevSuccess(null);
    } finally {
      setManualSyllabusLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6 flex flex-col items-center justify-center relative">
      <div className="w-full max-w-4xl mx-auto bg-gray-900 rounded-2xl shadow-2xl p-8 border border-blue-800 animate-fade-in">
        {/* Official CBSE Syllabus Link */}
        <div className="mb-6 flex flex-col items-center">
          <a
            href="https://cbseacademic.nic.in/curriculum_2026.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2 rounded-lg shadow transition mb-2"
          >
            📄 View the Latest Official CBSE Syllabus (2025-26)
          </a>
          <span className="text-xs text-blue-300">Always refer to the official CBSE website for the most accurate and up-to-date syllabus.</span>
        </div>
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
        {activeTab === 'Dev' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-blue-400 mb-4">CBSE Syllabus Dev</h2>
            <div className="bg-blue-950 border border-blue-800 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-blue-300 mb-2">📚 Syllabus Management</h3>
              <p className="text-blue-200 text-sm">
                This dev tab allows you to fetch and save syllabi to the database. Once saved, syllabi will be automatically loaded 
                from the database instead of being fetched from AI every time, making the process faster and more reliable.
              </p>
              <p className="text-purple-200 text-sm mt-2">
                💡 <strong>Manual Entry:</strong> If AI doesn't fetch complete syllabi, you can paste syllabus text manually and have AI parse it into the correct format.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block mb-1 font-semibold">Class</label>
                <select
                  className="w-full p-2 rounded border bg-gray-900 text-white"
                  value={devClass}
                  onChange={e => {
                    setDevClass(e.target.value);
                    setDevSubject('');
                  }}
                >
                  <option value="">Select Class</option>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {devClass === '12' && (
                <div>
                  <label className="block mb-1 font-semibold">Stream</label>
                  <select
                    className="w-full p-2 rounded border bg-gray-900 text-white"
                    value={devStream}
                    onChange={e => {
                      setDevStream(e.target.value as keyof typeof CLASS12_SUBJECTS);
                      setDevSubject('');
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
                  value={devSubject}
                  onChange={e => setDevSubject(e.target.value)}
                  disabled={!devClass || (devClass === '12' && !devStream)}
                >
                  <option value="">Select Subject</option>
                  {devClass === '10' && CLASS10_SUBJECTS.map((s: string) => <option key={s} value={s}>{s}</option>)}
                  {devClass === '12' && devStream && CLASS12_SUBJECTS[devStream] && CLASS12_SUBJECTS[devStream].map((s: string) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow transition disabled:opacity-50"
                  onClick={handleFetchSyllabus}
                  disabled={!devSubject || !devClass || devLoading}
                >
                  {devLoading ? 'Fetching...' : 'Fetch Syllabus'}
                </button>
                <button
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow transition"
                  onClick={() => setShowManualEntry(!showManualEntry)}
                  disabled={!devSubject || !devClass}
                >
                  {showManualEntry ? 'Hide Manual Entry' : 'Manual Entry'}
                </button>
              </div>
              <div>
                <button
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded shadow transition disabled:opacity-50"
                  onClick={handleSaveSyllabus}
                  disabled={!devSyllabus.length || !devSubject || !devClass || devLoading}
                >
                  {devLoading ? 'Saving...' : 'Save Syllabus'}
                </button>
              </div>
            </div>
            
            {/* Manual Syllabus Entry */}
            {showManualEntry && (
              <div className="bg-gray-800 rounded-lg border border-purple-900 p-4 mt-4">
                <h3 className="text-lg font-semibold text-purple-400 mb-3">📝 Manual Syllabus Entry</h3>
                <p className="text-gray-300 text-sm mb-4">
                  Paste the CBSE syllabus text here. The AI will parse it and extract units, chapters, and weightage.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2 font-semibold text-gray-300">Syllabus Text</label>
                    <textarea
                      className="w-full h-48 p-3 rounded border bg-gray-900 text-white resize-none"
                      placeholder="Paste the CBSE syllabus text here...&#10;&#10;Example:&#10;Unit–I: Electrostatics (16 marks)&#10;Chapter–1: Electric Charges and Fields&#10;Chapter–2: Electrostatic Potential and Capacitance&#10;&#10;Unit–II: Current Electricity (10 marks)&#10;Chapter–3: Current Electricity"
                      value={manualSyllabusText}
                      onChange={e => setManualSyllabusText(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded shadow transition disabled:opacity-50"
                      onClick={handleParseManualSyllabus}
                      disabled={!manualSyllabusText.trim() || !devSubject || !devClass || manualSyllabusLoading}
                    >
                      {manualSyllabusLoading ? 'Parsing...' : 'Parse with AI'}
                    </button>
                    <button
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded shadow transition"
                      onClick={() => {
                        setManualSyllabusText('');
                        setShowManualEntry(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            {devLoading && <div className="text-blue-400">Loading syllabus...</div>}
            {devError && <div className="text-red-400">{devError}</div>}
            {devSuccess && <div className="text-green-400">{devSuccess}</div>}
            {!devLoading && devSyllabus.length > 0 && (
              <div className="bg-gray-800 rounded-lg border border-blue-900 p-4">
                <h3 className="text-xl font-bold text-blue-400 mb-2">Loaded Syllabus for {devSubject} - Class {devClass}</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left text-gray-300">
                    <thead className="bg-blue-900 text-blue-200">
                      <tr>
                        <th className="px-3 py-2">Unit</th>
                        <th className="px-3 py-2">Weightage</th>
                        <th className="px-3 py-2">Chapters</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devSyllabus.map((unit, index) => (
                        <tr key={index} className="border-b border-blue-800">
                          <td className="px-3 py-2 font-semibold text-blue-400">{unit.unit}</td>
                          <td className="px-3 py-2 text-yellow-400 font-bold">{unit.weightage} marks</td>
                          <td className="px-3 py-2">
                            {unit.chapters && unit.chapters.length > 0 ? (
                              <ul className="list-disc list-inside text-white">
                                {unit.chapters.map((ch: { name: string; clo: string }) => (
                                  <li key={ch.name}>{ch.name} ({ch.clo})</li>
                                ))}
                              </ul>
                            ) : (
                              'No chapters defined for this unit.'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <h3 className="text-xl font-bold text-blue-400 mb-2">Saved Syllabi</h3>
            {syllabiLoading ? (
              <div className="text-blue-400">Loading saved syllabi...</div>
            ) : savedSyllabi.length === 0 ? (
              <div className="text-gray-400">No saved syllabi found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-300">
                  <thead className="bg-blue-900 text-blue-200">
                    <tr>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Class</th>
                      <th className="px-3 py-2">Units</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedSyllabi.map(s => (
                      <tr key={s.id} className="border-b border-blue-800">
                        <td className="px-3 py-2">{s.subject}</td>
                        <td className="px-3 py-2">{s.class_level}</td>
                        <td className="px-3 py-2">{s.units_count}</td>
                        <td className="px-3 py-2">
                          <button
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs mr-2"
                            onClick={() => handleLoadSyllabus(s)}
                          >
                            Load
                          </button>
                          <button
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs"
                            onClick={() => handleDeleteSyllabus(s.id)}
                          >
                            Delete
                          </button>
                        </td>
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