import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, ChevronRight, FileText, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import OpenAIService from '../lib/openaiService';
import { pdfFileToImageDataUrls } from '../lib/pdfToImages';

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
async function generateQuestionsWithGemini({ subject, classLevel, chapters, examType, difficulty, sectionTypes, totalMarks }: Omit<GeminiQuestionGenParams, 'numQuestions'> & { totalMarks: number }) {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  
  // Calculate appropriate number of questions based on total marks
  // For CBSE pattern: typically 1-5 marks per question, so we'll aim for reasonable distribution
  const defaultMarks = SUBJECT_TOTAL_MARKS[`${classLevel} ${subject}`] || 80;
  const defaultQuestions = 35; // Typical CBSE paper has ~35 questions
  const questionRatio = totalMarks / defaultMarks;
  const targetQuestions = Math.max(5, Math.min(50, Math.round(defaultQuestions * questionRatio)));
  
  const prompt = `Refer to the official CBSE previous year question papers and the latest syllabus for the academic year 2025-26 at https://cbseacademic.nic.in/curriculum_2026.html for Class ${classLevel} ${subject}.
Search for the typical number and distribution of each question type (e.g., how many MCQs, short answer, long answer, etc.) in real CBSE board papers for this subject/class. Match the real CBSE pattern for the number of each question type and their marks, using the latest available data from previous year papers and the official CBSE pattern.

Generate approximately ${targetQuestions} questions for a total of ${totalMarks} marks. The number of questions should be reasonable for the total marks - typically between 5 and 50 questions depending on the total marks.

Generate a CBSE-style question paper for Class ${classLevel} ${subject} (${examType} Exam), following the latest CBSE syllabus and matching the real distribution of marks, question types, and chapter weightage as seen in actual CBSE board exams.

The total marks for the paper MUST be exactly ${totalMarks}. The sum of all question marks must be exactly ${totalMarks} and must NOT exceed ${totalMarks} under any circumstances.

Use only these chapters: ${chapters.join(", ")}. Distribute questions across these section types: ${sectionTypes.join(", ")}. 

For each question, provide: section, type, marks, and question text. 
For MCQ questions (type: "mcq"), also include an "options" field as an array with exactly 4 options (A, B, C, D) and a "correct_answer" field (A, B, C, or D).

Example MCQ format:
{
  "section": "A",
  "type": "mcq",
  "marks": 1,
  "question": "What is 2+2?",
  "options": ["3", "4", "5", "6"],
  "correct_answer": "B"
}

Return ONLY a valid JSON array, no explanation or extra text. Do NOT wrap the JSON in any Markdown or code block. Each item should have fields: section, type, marks, question, and for MCQs: options (array), correct_answer.`;
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
    if (Array.isArray(questions) && questions.length === 0) {
      alert('AI did not generate any questions. Please try again.');
    }
    return questions;
  } catch (e) {
    const match = cleanText.match(/\[.*\]/s);
    if (match) {
      try {
        const questions = JSON.parse(match[0]);
        if (Array.isArray(questions) && questions.length === 0) {
          alert('AI did not generate any questions. Please try again.');
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
  const [useCustomMarks, setUseCustomMarks] = useState(false);
  const [customMarks, setCustomMarks] = useState(80);
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
  // Vision (handwriting from PDF) states
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionText, setVisionText] = useState('');
  const [visionError, setVisionError] = useState<string | null>(null);

  const handleExtractHandwritingFromPdf = async (file: File) => {
    try {
      setVisionLoading(true);
      setVisionError(null);
      setVisionText('');
      const images = await pdfFileToImageDataUrls(file, 1400, 'image/jpeg', 0.85);
      const limited = images.slice(0, 6);
      const openai = OpenAIService.getInstance();
      const text = await openai.analyzeImagesWithVision(
        limited,
        'Extract all handwritten answers accurately. Preserve question numbering and line breaks. If any part is unreadable, mark as [illegible]. Return plain text.'
      );
      setVisionText(text);
    } catch (e: any) {
      setVisionError(e.message || 'Failed to extract handwriting');
    } finally {
      setVisionLoading(false);
    }
  };
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

  // Reset custom marks when subject/class changes
  useEffect(() => {
    if (selectedSubject && selectedClass) {
      const defaultMarks = SUBJECT_TOTAL_MARKS[`${selectedClass} ${selectedSubject}`] || 80;
      setCustomMarks(defaultMarks);
      setUseCustomMarks(false);
    }
  }, [selectedSubject, selectedClass]);

  const renderProgress = () => (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((stepObj, idx) => (
        <div key={stepObj.label} className="flex items-center">
          <div className={`flex flex-col items-center ${step > idx + 1 ? 'text-success-400' : step === idx + 1 ? 'text-primary-500' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${step > idx + 1 ? 'bg-success-500/20 border-success-500' : step === idx + 1 ? 'bg-primary-500/20 border-primary-500' : 'bg-gray-700/20 border-gray-600'} border-2`}>
              <stepObj.icon className="w-5 h-5" />
            </div>
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
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Exam Configuration</h2>
        <p className="text-gray-300">Select your exam details to get started</p>
      </div>
      <div className="card-elevated">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block mb-2 font-semibold text-white">Class</label>
            <select
              className="form-input w-full"
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
              <label className="block mb-2 font-semibold text-white">Stream</label>
              <select
                className="form-input w-full"
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
            <label className="block mb-2 font-semibold text-white">Subject</label>
            <select
              className="form-input w-full"
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
            <label className="block mb-2 font-semibold text-white">Exam Type</label>
            <select
              className="form-input w-full"
              value={examType}
              onChange={e => setExamType(e.target.value)}
            >
              <option value="">Select Type</option>
              {EXAM_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-center">
          <button
            className="btn-primary px-8 py-3"
            disabled={!selectedSubject || !selectedClass || !examType}
            onClick={() => setStep(2)}
          >
            Next: Choose Chapters
          </button>
        </div>
      </div>
    </div>
  );

  // Step 2: Select chapters, difficulty, sections, number of questions
  const renderStep2 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Chapter Selection & Settings</h2>
        <p className="text-gray-300">Choose chapters and configure exam parameters</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-elevated">
          <h3 className="text-lg font-bold text-white mb-4">Chapters (with weightage)</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {aiChapters.length > 0 && (
              <label className="flex items-center gap-2 bg-primary-500/10 rounded-lg p-3 cursor-pointer mb-2 border border-primary-500/30">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => handleSelectAllChapters(e.target.checked)}
                  className="text-primary-500"
                />
                <span className="font-semibold text-primary-300">Select All Chapters</span>
              </label>
            )}
            {aiChapters.length > 0 && (
              <div className="text-xs text-primary-300 mb-2 p-2 bg-primary-500/5 rounded">
                <span>Note: Only group/unit weightage is official. Chapter weightage is not provided by CBSE.</span><br />
                <span className="text-warning-300">This simulator generates the theory paper only. Practical/Internal Assessment marks are not included.</span>
              </div>
            )}
            {chaptersLoading && <div className="text-primary-400 flex items-center gap-2"><div className="loading-spinner w-4 h-4"></div>Loading chapters...</div>}
            {chaptersError && <div className="text-red-400">{chaptersError}</div>}
            {!chaptersLoading && !chaptersError && aiChapters.length === 0 && (
              <div className="text-gray-400">Select a subject and class to load chapters.</div>
            )}
            {aiChapters.map(unit => (
              <div key={unit.unit} className="mb-3 bg-gray-800/50 rounded-lg border border-primary-500/20 p-3">
                <div className="flex items-center mb-2">
                  <span className="font-bold text-primary-400 text-base mr-2">{unit.unit}</span>
                </div>
                {/* Chapters directly under unit */}
                {unit.chapters && unit.chapters.length > 0 && (
                  <div className="space-y-1 ml-4">
                    {unit.chapters.map(ch => (
              <label key={ch.name} className="flex items-center gap-2 bg-gray-700/50 rounded p-2 cursor-pointer hover:bg-primary-500/10 transition">
                <input
                  type="checkbox"
                  checked={selectedChapters.includes(ch.name)}
                  onChange={e => {
                    if (e.target.checked) setSelectedChapters([...selectedChapters, ch.name]);
                    else setSelectedChapters(selectedChapters.filter(c => c !== ch.name));
                  }}
                  className="text-primary-500"
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
                        <div className="font-semibold text-primary-300 mb-1">{su.subunit}</div>
                        <div className="space-y-1 ml-4">
                          {su.chapters.map(ch => (
              <label key={ch.name} className="flex items-center gap-2 bg-gray-700/50 rounded p-2 cursor-pointer hover:bg-primary-500/10 transition">
                <input
                  type="checkbox"
                  checked={selectedChapters.includes(ch.name)}
                  onChange={e => {
                    if (e.target.checked) setSelectedChapters([...selectedChapters, ch.name]);
                    else setSelectedChapters(selectedChapters.filter(c => c !== ch.name));
                  }}
                  className="text-primary-500"
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
          <div className="card-elevated">
            <h3 className="text-lg font-bold text-white mb-4">Exam Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold text-white">Difficulty</label>
                <select
                  className="form-input w-full"
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value)}
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 font-semibold text-white">Section Types</label>
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
                        className="text-primary-500"
                      />
                      <span className="text-white">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block mb-2 font-semibold text-white">Total Marks</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      checked={!useCustomMarks}
                      onChange={() => setUseCustomMarks(false)}
                      className="text-primary-500"
                    />
                    <span className={!useCustomMarks ? "text-primary-400 font-semibold" : "text-gray-300"}>
                      Use Default ({SUBJECT_TOTAL_MARKS[`${selectedClass} ${selectedSubject}`] || 80} marks)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      checked={useCustomMarks}
                      onChange={() => setUseCustomMarks(true)}
                      className="text-primary-500"
                    />
                    <span className={useCustomMarks ? "text-primary-400 font-semibold" : "text-gray-300"}>
                      Custom Marks
                    </span>
                  </label>
                  {useCustomMarks && (
                    <div className="ml-6 p-3 bg-primary-500/10 rounded-lg border border-primary-500/30">
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={customMarks}
                        onChange={(e) => setCustomMarks(parseInt(e.target.value) || 80)}
                        className="form-input w-full"
                        placeholder="Enter custom marks"
                      />
                      <div className="text-xs text-primary-300 mt-1">
                        Enter the total marks for your custom paper (1-200). The AI will generate fewer questions for lower marks and more questions for higher marks.
                      </div>
                      {selectedSubject && selectedClass && (
                        <div className="text-xs text-warning-300 mt-2">
                          Estimated questions: ~{Math.max(5, Math.min(50, Math.round(35 * (customMarks / (SUBJECT_TOTAL_MARKS[`${selectedClass} ${selectedSubject}`] || 80)))))} 
                          (vs {SUBJECT_TOTAL_MARKS[`${selectedClass} ${selectedSubject}`] || 80} marks default)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-4 mt-6 justify-center">
        <button
          className="btn-secondary px-6 py-3"
          onClick={() => setStep(1)}
        >
          Back
        </button>
        <button
          className="btn-primary px-6 py-3"
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
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Preview Question Paper</h2>
        <p className="text-gray-300">Review and generate your CBSE-style exam paper</p>
      </div>
      <div ref={previewRef} className="card-elevated">
        <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-semibold text-white">{selectedSubject} - Class {selectedClass} ({examType} Exam)</div>
            <div className="text-sm text-gray-400">Chapters: {selectedChapters.join(', ')}</div>
            <div className="text-sm text-gray-400">
              Difficulty: {difficulty} | Sections: {selectedSections.join(', ')} | Total Questions: {questions.length} | 
              Total Marks: {useCustomMarks ? customMarks : (SUBJECT_TOTAL_MARKS[`${selectedClass} ${selectedSubject}`] || 80)}
              {useCustomMarks && (
                <span className="text-warning-400"> (Custom - ~{Math.max(5, Math.min(50, Math.round(35 * (customMarks / (SUBJECT_TOTAL_MARKS[`${selectedClass} ${selectedSubject}`] || 80)))))} questions)</span>
              )}
            </div>
          </div>
        </div>
        {questions.length > 0 ? questions.map((q, i) => (
          <div key={i} className="py-6 px-4 bg-gradient-to-r from-primary-500/5 via-gray-800/50 to-primary-500/5 rounded-xl mb-4 border border-primary-500/20 animate-fade-in">
            <div className="flex items-center gap-4 mb-2">
              <span className="bg-primary-600 text-white px-3 py-1 rounded-full text-xs font-bold tracking-widest shadow">Section {q.section}</span>
              <span className="bg-gray-700 text-primary-200 px-2 py-1 rounded text-xs uppercase tracking-wide">{q.type}</span>
              <span className="ml-auto text-warning-400 font-bold">[{q.marks} mark{q.marks > 1 ? 's' : ''}]</span>
            </div>
            <div className="text-white text-lg font-medium pl-2 border-l-4 border-primary-600 question-math">
              {i + 1}. {parseMathInline(q.question)}
            </div>
            {q.type === 'mcq' && q.options && Array.isArray(q.options) && (
              <div className="mt-4 ml-6 space-y-2">
                {q.options.map((option: string, optIndex: number) => (
                  <div key={optIndex} className="flex items-center gap-3 text-gray-300">
                    <span className="font-bold text-primary-400 w-6">({String.fromCharCode(65 + optIndex)})</span>
                    <span>{parseMathInline(option)}</span>
                  </div>
                ))}
              </div>
            )}
            {q.type === 'mcq' && (!q.options || !Array.isArray(q.options)) && (
              <div className="mt-4 ml-6 text-warning-400 text-sm">
                ⚠️ MCQ options not properly generated. Please regenerate the paper.
              </div>
            )}
          </div>
        )) : (
          <div className="text-center text-gray-400 py-8">
            No questions generated yet. Click "Generate with AI" to create a CBSE-style question paper.
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-4 justify-center">
        <button
          className="btn-secondary px-4 py-2"
          onClick={handleExportPDF}
        >
          Export as PDF
        </button>
        <button
          className="btn-secondary px-6 py-2"
          onClick={() => setStep(2)}
        >
          Back
        </button>
        <button
          className="btn-primary px-6 py-2"
          onClick={async () => {
            setGenerating(true);
            setQuestions([]);
            try {
              const totalMarks = useCustomMarks ? customMarks : (SUBJECT_TOTAL_MARKS[`${selectedClass} ${selectedSubject}`] || 80);
              const aiQuestions = await generateQuestionsWithGemini({
                subject: selectedSubject,
                classLevel: selectedClass,
                chapters: selectedChapters,
                examType,
                difficulty,
                sectionTypes: selectedSections,
                totalMarks,
              });
              setQuestions(aiQuestions);
            } catch (err) {
              alert('AI generation failed: ' + err);
            }
            setGenerating(false);
          }}
          disabled={generating}
        >
          {generating ? (
            <div className="flex items-center gap-2">
              <div className="loading-spinner w-4 h-4"></div>
              Generating...
            </div>
          ) : (
            'Generate with AI'
          )}
        </button>
        <button
          className="btn-accent px-6 py-2"
          onClick={() => {
            const totalMarks = useCustomMarks ? customMarks : (SUBJECT_TOTAL_MARKS[`${selectedClass} ${selectedSubject}`] || 80);
            navigate('/cbse-exam-session', { 
              state: { 
                questions,
                selectedSubject,
                totalMarks,
                useCustomMarks
              } 
            });
          }}
          disabled={questions.length === 0}
        >
          Start Exam
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center glow-blue">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            CBSE <span className="gradient-text">Exam Simulator</span>
          </h1>
        </div>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
          Generate authentic CBSE-style question papers with AI-powered questions that follow the latest syllabus and marking schemes.
        </p>
      </div>



      {/* Official CBSE Syllabus Link */}
      <div className="text-center mb-8">
        <a
          href="https://cbseacademic.nic.in/curriculum_2026.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all duration-300 hover:scale-105"
        >
          📄 View the Latest Official CBSE Syllabus (2025-26)
        </a>
        <p className="text-xs text-primary-300 mt-2">Always refer to the official CBSE website for the most accurate and up-to-date syllabus.</p>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-700">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`px-4 py-2 font-semibold focus:outline-none transition-colors duration-200 ${activeTab === tab ? 'border-b-2 border-primary-500 text-primary-400' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

      {/* Tab Content */}
      {activeTab === 'Exam Simulator' && (
        <div className="card-elevated">
          {renderProgress()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>
      )}

      {activeTab === 'Saved Results' && (
        <div className="card-elevated animate-fade-in">
          <h2 className="text-2xl font-bold text-white mb-6">Saved Results</h2>
          {/* Handwriting extraction with GPT-4 Vision */}
          <div className="mb-8 p-4 rounded-xl border border-gray-700 bg-gray-800/50">
            <h3 className="text-lg font-semibold text-white mb-3">Extract Handwritten Answers from PDF</h3>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleExtractHandwritingFromPdf(f);
                }}
                className="form-input"
              />
              {visionLoading && (
                <div className="flex items-center gap-2 text-gray-300">
                  <div className="loading-spinner w-4 h-4" /> Processing PDF with GPT‑4 Vision…
                </div>
              )}
            </div>
            {visionError && (
              <div className="mt-3 text-red-400 text-sm">{visionError}</div>
            )}
            {visionText && (
              <div className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap text-gray-200 bg-gray-900/60 p-3 rounded-lg text-sm">
                {visionText}
              </div>
            )}
            {!visionText && !visionLoading && (
              <p className="mt-2 text-xs text-gray-400">Tip: Large PDFs can be slow and costly. We process up to 6 pages by default.</p>
            )}
          </div>
          {resultsLoading ? (
            <div className="text-center py-8">
              <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading results...</p>
            </div>
          ) : resultsError ? (
            <div className="text-red-400 text-center py-8">{resultsError}</div>
          ) : savedResults.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-400">No saved results found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left text-gray-300">
                <thead className="bg-primary-500/20 text-primary-200">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Sheet</th>
                  </tr>
                </thead>
                <tbody>
                  {savedResults.map((r, i) => (
                    <tr key={r.id || i} className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">{r.exam_date ? new Date(r.exam_date).toLocaleString() : ''}</td>
                      <td className="px-4 py-3">{r.subject || '-'}</td>
                      <td className="px-4 py-3">{r.class_level || '-'}</td>
                      <td className="px-4 py-3">{r.total_score} / {r.max_score}</td>
                      <td className="px-4 py-3">
                        {r.answer_sheet_url && (
                          <a 
                            href={r.answer_sheet_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-primary-400 hover:text-primary-300 underline transition-colors"
                          >
                            View
                          </a>
                        )}
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