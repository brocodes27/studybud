import React, { useState, useEffect, useRef } from "react";
import { BookOpen, ChevronRight, FileText, Zap, Clock, Download, Upload, CheckCircle, AlertTriangle, Search, Brain, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import OpenAIService from "../lib/openaiService";
import { pdfFileToImageDataUrls } from "../lib/pdfToImages";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import { getPaperBlueprint, generateBlueprintPrompt } from "../lib/paperBlueprints";

// Helper to render mixed text and inline LaTeX math delimited by $...$
function parseMathInline(text: any) {
  const str = typeof text === "string" ? text : String(text ?? "");
  const parts = str.split(/(\$[^$]+\$)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("$") && part.endsWith("$")) {
      return (
        <InlineMath key={idx} math={part.slice(1, -1)} errorColor="#cc0000" />
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

const CLASS10_SUBJECTS = [
  "Mathematics",
  "Science",
  "English",
  "Social Science",
  "Hindi",
  "Sanskrit",
  "Information Technology",
  "Home Science",
  "Computer Applications",
];

const CLASS12_SUBJECTS = {
  Science: [
    "Physics",
    "Chemistry",
    "Mathematics",
    "Biology",
    "English",
    "Computer Science",
    "Physical Education",
    "Informatics Practices",
  ],
  Commerce: [
    "Accountancy",
    "Business Studies",
    "Economics",
    "Mathematics",
    "English",
    "Informatics Practices",
    "Physical Education",
  ],
  Humanities: [
    "History",
    "Geography",
    "Political Science",
    "Economics",
    "Psychology",
    "Sociology",
    "English",
    "Mathematics",
    "Physical Education",
  ],
};
const CLASSES = ["10", "12"];
const EXAM_TYPES = ["Board", "Pre-Board", "Practice"];
// Add subject/class to total marks mapping
export const SUBJECT_TOTAL_MARKS: Record<string, number> = {
  // --- Class 10 ---
  "10 English Language & Literature": 80,
  "10 Hindi Course A": 80,
  "10 Hindi Course B": 80,
  "10 Mathematics": 80,
  "10 Science": 80,
  "10 Social Science": 80,
  "10 Information Technology": 50,
  "10 Artificial Intelligence": 50,
  // Add other skill/optional subjects as needed

  // --- Class 12 Science ---
  "12 Physics": 70,
  "12 Chemistry": 70,
  "12 Biology": 70,
  "12 Mathematics": 80,
  "12 Computer Science": 70,
  "12 Informatics Practices": 70,
  "12 English Core": 80,

  // --- Class 12 Commerce ---
  "12 Accountancy": 80,
  "12 Business Studies": 80,
  "12 Economics": 80,
  "12 Applied Mathematics": 80,
  "12 Entrepreneurship": 70,

  // --- Class 12 Humanities ---
  "12 History": 80,
  "12 Geography": 70,
  "12 Political Science": 80,
  "12 Sociology": 80,
  "12 Psychology": 70,
  "12 Physical Education": 70,
  // Add Fine Arts, Music, Dance, etc. as needed
};
// Add subject-specific expected unit counts
const SUBJECT_EXPECTED_UNITS: Record<string, { min: number; max: number }> = {
  // Class 10
  "10 Mathematics": { min: 6, max: 8 },
  "10 Science": { min: 5, max: 7 },
  "10 English Language & Literature": { min: 4, max: 6 },
  "10 Social Science": { min: 4, max: 6 },
  "10 Hindi Course A": { min: 4, max: 6 },
  "10 Hindi Course B": { min: 4, max: 6 },

  // Class 12 Science
  "12 Physics": { min: 9, max: 10 },
  "12 Chemistry": { min: 9, max: 10 },
  "12 Biology": { min: 8, max: 10 },
  "12 Mathematics": { min: 6, max: 8 },
  "12 Computer Science": { min: 4, max: 6 },
  "12 Informatics Practices": { min: 4, max: 6 },
  "12 English Core": { min: 3, max: 5 },

  // Class 12 Commerce
  "12 Accountancy": { min: 4, max: 6 },
  "12 Business Studies": { min: 4, max: 6 },
  "12 Economics": { min: 4, max: 6 },
  "12 Applied Mathematics": { min: 6, max: 8 },

  // Class 12 Humanities
  "12 History": { min: 4, max: 6 },
  "12 Geography": { min: 4, max: 6 },
  "12 Political Science": { min: 4, max: 6 },
  "12 Sociology": { min: 4, max: 6 },
  "12 Psychology": { min: 4, max: 6 },
  "12 Physical Education": { min: 4, max: 6 },
};

async function fetchChaptersWithAI(subject: string, classLevel: string) {
  const officialTotalMarks =
    SUBJECT_TOTAL_MARKS[`${classLevel} ${subject}`] || 80;
  const expectedUnits = SUBJECT_EXPECTED_UNITS[`${classLevel} ${subject}`] || {
    min: 4,
    max: 8,
  };

  // First check if syllabus exists in database
  try {
    const { data: savedSyllabus, error } = await supabase
      .from("cbse_syllabi")
      .select("syllabus_data")
      .eq("subject", subject)
      .eq("class_level", classLevel)
      .single();

    if (!error && savedSyllabus?.syllabus_data) {
      console.log("Using saved syllabus from database");
      return savedSyllabus.syllabus_data;
    }
  } catch (error) {
    console.log("No saved syllabus found, fetching from AI...");
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
      if (
        Array.isArray(chapters) &&
        chapters.length >= expectedUnits.min &&
        chapters.length <= expectedUnits.max
      ) {
        return chapters;
      } else {
        console.log(
          `Attempt ${attempts + 1}: Incomplete syllabus (${chapters.length} units, expected ${expectedUnits.min}-${expectedUnits.max}). Retrying...`,
        );
        attempts++;
        if (attempts >= maxAttempts) {
          console.warn(
            `Failed to get complete syllabus after ${maxAttempts} attempts. Returning partial syllabus (${chapters.length} units).`,
          );
          return chapters;
        }
      }
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error(
          `Failed to fetch chapters after ${maxAttempts} attempts: ${error}`,
        );
      }
      console.log(`Attempt ${attempts} failed, retrying...`);
    }
  }
}

// removed: student-facing pool builder

async function generatePaperWithRAG({
  classLevel,
  subject,
  chapters,
  difficulty,
  totalMarks,
  sections,
  chapterWeightage,
}: {
  classLevel: string;
  subject: string;
  chapters: string[];
  difficulty: string;
  totalMarks: number;
  sections: string[];
  chapterWeightage?: { unit: string; weightage: number; chapters: string[] }[];
}) {
  const openai = OpenAIService.getInstance();

  // 1. Retrieve relevant PYQs (RAG)
  let similarQuestions: any[] = [];
  try {
    // Create a search query based on the exam parameters
    const query = `Class ${classLevel} ${subject} questions about ${chapters.join(", ")}`;
    const embedding = await openai.getEmbedding(query);

    // Search for similar questions in the vector db
    similarQuestions = await openai.searchSimilarQuestions(
      embedding,
      0.4, // Lower threshold to get more variety
      10,  // Count
      classLevel,
      subject
    );
    console.log(`RAG: Found ${similarQuestions.length} relevant PYQs`);
  } catch (e) {
    console.warn("RAG retrieval failed, proceeding with zero-shot generation:", e);
  }

  // 2. Construct Prompt with RAG Context
  const ragContext = similarQuestions.length > 0
    ? `\n\nREFERENCE THESE REAL CBSE QUESTIONS FOR STYLE AND DIFFICULTY:\n${JSON.stringify(similarQuestions.map(q => ({ q: q.question, marks: q.marks, type: q.type })), null, 2)}`
    : "";

  // Construct Weightage Context
  const weightageContext = chapterWeightage
    ? `\n\nSTRICT CHAPTER WEIGHTAGE:\n${chapterWeightage.map(u => `- ${u.unit} (${u.chapters.join(", ")}): ${u.weightage} marks`).join("\n")}\nEnsure the total marks for questions from each unit align with these weightages.`
    : "";

  // Get actual blueprint
  let blueprint = getPaperBlueprint(classLevel, subject);

  // Only use blueprint if the requested totalMarks matches the blueprint's totalMarks
  if (blueprint && blueprint.totalMarks !== totalMarks) {
    blueprint = null;
  }

  const blueprintContext = blueprint ? generateBlueprintPrompt(blueprint) : "";

  const prompt = `Generate a CBSE Class ${classLevel} ${subject} exam paper with ${totalMarks} marks.

REQUIREMENTS:
1. Difficulty: ${difficulty}
2. Chapters to cover: ${chapters.join(", ")}
3. Include these question types: ${sections.join(", ")}

CBSE QUALITY STANDARDS:
- Use real-world scenarios and application-based questions (competency-based)
- For Math/Science: Use LaTeX notation with $ symbols for formulas
- MCQs must have exactly 4 options labeled A, B, C, D
- Assertion-Reasoning: Include at least 2 Assertion-Reasoning type questions within the MCQ section.
- Follow official CBSE marking scheme distribution
${weightageContext}
${ragContext}
${blueprintContext}

STRICT OUTPUT FORMAT:
Return ONLY a valid JSON array. Each question object must have:
{
  "section": "A" or "B" or "C",
  "type": "mcq" or "short" or "long",
  "question": "question text here",
  "marks": number,
  "options": ["A text", "B text", "C text", "D text"] (REQUIRED for MCQs)
}

${blueprint ? `Generate EXACTLY the number of questions specified in the paper structure above (Total: ${blueprint.structure.reduce((sum, item) => sum + item.count, 0)} questions).` : `Generate approximately ${Math.ceil(totalMarks / 3)} questions to reach ${totalMarks} marks total.`}`;

  // 3. Call GPT-4o
  const text = await openai.generateChatCompletion(prompt, "You are an expert CBSE exam setter.");

  console.log("RAG: Raw OpenAI Response (first 500 chars):", text.substring(0, 500));

  // 4. Parse Response with robust error handling
  try {
    let cleanText = text.trim();

    // Remove markdown code fences
    cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    // Try to extract JSON array if surrounded by text
    const arrayMatch = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      cleanText = arrayMatch[0];
    }

    const questions = JSON.parse(cleanText);

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Response is not a valid question array or is empty");
    }

    console.log(`RAG: Successfully parsed ${questions.length} questions`);
    return { questions };

  } catch (parseError: any) {
    console.error("RAG: JSON Parse Error:", parseError.message);
    console.error("RAG: Failed response text:", text);
    throw new Error(`Failed to parse OpenAI response: ${parseError.message}. This usually means the response was truncated or malformed. Try reducing the number of chapters or total marks.`);
  }
}

// removed: AI paper generation helper (DB-only flow)

async function generateAnswerKeyWithGemini({
  subject,
  classLevel,
  questions,
}: {
  subject: string;
  classLevel: string;
  questions: any[];
}) {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const questionsForAi = questions.map((q: any, idx: number) => ({
    index: idx + 1,
    type: q.type,
    marks: q.marks,
    question: q.question,
    options: Array.isArray(q.options) ? q.options : undefined,
  }));

  const prompt = `You are preparing an official teacher's answer key for CBSE Class ${classLevel} ${subject}.
For each question below, return a concise, marking - scheme - aligned answer.

    Rules:
  - For MCQs: return the correct option letter(A / B / C / D) in 'correct_answer' and a one - line justification in 'explanation'.
- For Short / Long answers: return a crisp 'answer' string that covers all key points; keep within 2 - 6 lines.
- Keep language neutral and suitable for an official answer key.
- Do NOT exceed the maximum marks logic for details; prioritize points typically awarded in CBSE marking schemes.

Return ONLY a valid JSON array of length equal to the input questions, where each item has:
  { "index": number, "type": "mcq" | "short" | "long", "answer" ?: string, "correct_answer" ?: "A" | "B" | "C" | "D", "explanation" ?: string }.

  Questions:
${JSON.stringify(questionsForAi, null, 2)} `;
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    GEMINI_API_KEY;
  const body = { contents: [{ parts: [{ text: prompt }] }] } as any;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Gemini API error: " + response.statusText);
  const data = await response.json();
  let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let cleanText = text.trim();
  cleanText = cleanText
    .replace(/^(```json | ```|'''json|''')/i, "")
    .replace(/(``` | ''')$/i, "")
    .trim();
  try {
    const arr = JSON.parse(cleanText);
    if (!Array.isArray(arr) || arr.length !== questions.length)
      throw new Error("Answer key length mismatch");
    return arr;
  } catch (e) {
    const match = cleanText.match(/\[.*\]/s);
    if (match) {
      try {
        const arr = JSON.parse(match[0]);
        if (!Array.isArray(arr)) throw new Error("Invalid answer key format");
        return arr;
      } catch { }
    }
    throw new Error("Failed to parse Gemini answer key response");
  }
}

async function exportTeacherDocx({
  subject,
  classLevel,
  examType,
  questions,
  answers,
}: {
  subject: string;
  classLevel: string;
  examType: string;
  questions: any[];
  answers: any[];
}) {
  const children: Paragraph[] = [];
  const title = `CBSE Exam Paper – ${subject} Class ${classLevel} (${examType})`;
  children.push(
    new Paragraph({
      text: `${title} [Teacher Pack]`,
      heading: HeadingLevel.TITLE,
    }),
  );
  children.push(new Paragraph({ text: "" }));

  // Section: Question Paper
  children.push(
    new Paragraph({
      text: "Section 1: Question Paper",
      heading: HeadingLevel.HEADING_1,
    }),
  );
  questions.forEach((q: any, idx: number) => {
    const qNum = idx + 1;
    children.push(
      new Paragraph({
        text: `${qNum}. [${q.marks} mark${q.marks > 1 ? "s" : ""}] ${q.question}`,
      }),
    );
    if (q.type === "mcq" && Array.isArray(q.options)) {
      q.options.forEach((opt: string, i: number) => {
        const label = String.fromCharCode(65 + i);
        children.push(new Paragraph({ text: `   (${label}) ${opt}` }));
      });
    }
    children.push(new Paragraph({ text: "" }));
  });

  // Section: Answer Key
  children.push(
    new Paragraph({
      text: "Section 2: Answer Key",
      heading: HeadingLevel.HEADING_1,
    }),
  );
  answers.forEach((a: any, idx: number) => {
    const qNum = idx + 1;
    if ((a?.type || questions[idx]?.type) === "mcq") {
      const line = `Q${qNum}: Correct Answer – ${a?.correct_answer || questions[idx]?.correct_answer || "-"}${a?.explanation ? ` | ${a.explanation}` : ""}`;
      children.push(new Paragraph({ text: line }));
    } else {
      const line = `Q${qNum}: ${a?.answer || "Answer not available"}`;
      children.push(new Paragraph({ text: line }));
    }
  });

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const fileName = `CBSE_${subject.replace(/\s+/g, "_")}_Class${classLevel}_Teacher_Pack.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const SECTION_TYPES = [
  { label: "MCQ", value: "mcq" },
  { label: "Short Answer", value: "short" },
  { label: "Long Answer", value: "long" },
];

const STEPS = [
  { label: "Exam Details", icon: BookOpen },
  { label: "Chapters & Settings", icon: FileText },
  { label: "Preview & Generate", icon: Zap },
];


const TABS = ["Exam Simulator", "Saved Results"];

const CBSEExamSimulator: React.FC = () => {
  const [step, setStep] = useState(1);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [examType, setExamType] = useState("");
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState("Medium");
  const [numQuestions, setNumQuestions] = useState(10);
  const [selectedSections, setSelectedSections] = useState<string[]>(
    SECTION_TYPES.map((s) => s.value),
  );
  const [questions, setQuestions] = useState<any[]>([]);
  const navigate = useNavigate();
  const { user, role } = useAuth() as any;
  const isTeacher = role === "teacher";
  const [activeTab, setActiveTab] = useState("Exam Simulator");
  // Vision (handwriting from PDF) states
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionText, setVisionText] = useState("");
  const [visionError, setVisionError] = useState<string | null>(null);
  // Teacher DOCX export states
  const [docxDownloading, setDocxDownloading] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  // Missing states restored
  const [selectedStream, setSelectedStream] =
    useState<keyof typeof CLASS12_SUBJECTS>("Science");
  const [useCustomMarks, setUseCustomMarks] = useState(false);
  const [customMarks, setCustomMarks] = useState(80);
  const [assembling, setAssembling] = useState(false);
  const [aiChapters, setAiChapters] = useState<
    {
      unit: string;
      weightage: number;
      subunits?: {
        subunit: string;
        chapters: { name: string; clo: string }[];
      }[];
      chapters?: { name: string; clo: string }[];
    }[]
  >([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [chaptersError, setChaptersError] = useState<string | null>(null);

  const handleExtractHandwritingFromPdf = async (file: File) => {
    try {
      setVisionLoading(true);
      setVisionError(null);
      setVisionText("");
      const images = await pdfFileToImageDataUrls(
        file,
        1400,
        "image/jpeg",
        0.85,
      );
      const limited = images.slice(0, 6);
      const openai = OpenAIService.getInstance();
      const text = await openai.analyzeImagesWithVision(
        limited,
        "Extract all handwritten answers accurately. Preserve question numbering and line breaks. If any part is unreadable, mark as [illegible]. Return plain text.",
      );
      setVisionText(text);
    } catch (e: any) {
      setVisionError(e.message || "Failed to extract handwriting");
    } finally {
      setVisionLoading(false);
    }
  };

  const [savedResults, setSavedResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "Saved Results" && user) {
      setResultsLoading(true);
      setResultsError(null);
      supabase
        .from("cbse_exam_attempts")
        .select("*")
        .eq("user_id", user.id)
        .order("exam_date", { ascending: false })
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
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    let imgHeight = (canvas.height * pdfWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }
    pdf.save(
      `CBSE_Question_Paper_${selectedSubject}_Class${selectedClass}.pdf`,
    );
  };

  const allChapterNames = aiChapters.flatMap((unit) => [
    ...(unit.chapters ? unit.chapters.map((ch) => ch.name) : []),
    ...(unit.subunits
      ? unit.subunits.flatMap((su) => su.chapters.map((ch) => ch.name))
      : []),
  ]);
  const allSelected =
    allChapterNames.length > 0 &&
    allChapterNames.every((name) => selectedChapters.includes(name));
  const handleSelectAllChapters = (checked: boolean) => {
    if (checked) setSelectedChapters(allChapterNames);
    else setSelectedChapters([]);
  };

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedSubject || !selectedClass) {
      setAiChapters([]);
      setChaptersError(null);
      return;
    }
    setChaptersLoading(true);
    setChaptersError(null);
    fetchChaptersWithAI(selectedSubject, selectedClass)
      .then((chapters) =>
        setAiChapters(Array.isArray(chapters) ? chapters : []),
      )
      .catch((err) =>
        setChaptersError(err.message || "Failed to fetch chapters"),
      )
      .finally(() => setChaptersLoading(false));
  }, [selectedSubject, selectedClass]);

  useEffect(() => {
    if (selectedSubject && selectedClass) {
      const defaultMarks =
        SUBJECT_TOTAL_MARKS[`${selectedClass} ${selectedSubject}`] || 80;
      setCustomMarks(defaultMarks);
      setUseCustomMarks(false);
    }
  }, [selectedSubject, selectedClass]);

  const renderProgress = () => (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((stepObj, idx) => (
        <div key={stepObj.label} className="flex items-center">
          <div
            className={`flex flex-col items-center ${step > idx + 1 ? "text-neon-green" : step === idx + 1 ? "text-neon-blue" : "text-gray-500"}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${step > idx + 1 ? "bg-neon-green/20 border-neon-green shadow-lg shadow-neon-green/20" : step === idx + 1 ? "bg-neon-blue/20 border-neon-blue shadow-lg shadow-neon-blue/20" : "bg-white/5 border-white/10"} border-2`}
            >
              <stepObj.icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold tracking-wide">{stepObj.label}</span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`mx-4 h-0.5 w-16 ${step > idx + 1 ? "bg-neon-green" : "bg-white/10"}`}></div>
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
          <BookOpen className="w-8 h-8 text-neon-blue" />
          Exam Configuration
        </h2>
        <p className="text-gray-400">Select your exam details to get started</p>
      </div>
      <div className="glass-panel p-8 rounded-2xl border border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block mb-2 font-semibold text-gray-300">
              Class
            </label>
            <select
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none appearance-none"
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSubject("");
              }}
            >
              <option value="" className="bg-gray-900">Select Class</option>
              {CLASSES.map((c) => (
                <option key={c} value={c} className="bg-gray-900">
                  {c}
                </option>
              ))}
            </select>
          </div>
          {selectedClass === "12" && (
            <div>
              <label className="block mb-2 font-semibold text-gray-300">
                Stream
              </label>
              <select
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none appearance-none"
                value={selectedStream}
                onChange={(e) => {
                  setSelectedStream(
                    e.target.value as keyof typeof CLASS12_SUBJECTS,
                  );
                  setSelectedSubject("");
                }}
              >
                {Object.keys(CLASS12_SUBJECTS).map((stream) => (
                  <option key={stream} value={stream} className="bg-gray-900">
                    {stream}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block mb-2 font-semibold text-gray-300">
              Subject
            </label>
            <select
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none appearance-none"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              disabled={
                !selectedClass || (selectedClass === "12" && !selectedStream)
              }
            >
              <option value="" className="bg-gray-900">Select Subject</option>
              {selectedClass === "10" &&
                CLASS10_SUBJECTS.map((s: string) => (
                  <option key={s} value={s} className="bg-gray-900">
                    {s}
                  </option>
                ))}
              {selectedClass === "12" &&
                selectedStream &&
                CLASS12_SUBJECTS[selectedStream] &&
                CLASS12_SUBJECTS[selectedStream].map((s: string) => (
                  <option key={s} value={s} className="bg-gray-900">
                    {s}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block mb-2 font-semibold text-gray-300">
              Exam Type
            </label>
            <select
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none appearance-none"
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
            >
              <option value="" className="bg-gray-900">Select Type</option>
              {EXAM_TYPES.map((e) => (
                <option key={e} value={e} className="bg-gray-900">
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-8 flex justify-center">
          <button
            className="bg-gradient-to-r from-neon-blue to-blue-600 hover:from-neon-blue/80 hover:to-blue-600/80 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-neon-blue/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={!selectedSubject || !selectedClass || !examType}
            onClick={() => setStep(2)}
          >
            Next: Choose Chapters
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
          <FileText className="w-8 h-8 text-neon-purple" />
          Chapter Selection & Settings
        </h2>
        <p className="text-gray-400">
          Choose chapters and configure exam parameters
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-neon-purple" />
            Chapters (with weightage)
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {aiChapters.length > 0 && (
              <label className="flex items-center gap-3 bg-neon-purple/10 rounded-xl p-3 cursor-pointer mb-4 border border-neon-purple/30 hover:bg-neon-purple/20 transition-colors">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => handleSelectAllChapters(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-500 text-neon-purple focus:ring-neon-purple bg-gray-800"
                />
                <span className="font-semibold text-neon-purple">
                  Select All Chapters
                </span>
              </label>
            )}
            {aiChapters.length > 0 && (
              <div className="text-xs text-gray-400 mb-4 p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="mb-1">
                  Note: Only group/unit weightage is official. Chapter weightage
                  is not provided by CBSE.
                </p>
                <p className="text-neon-yellow">
                  This simulator generates the theory paper only.
                  Practical/Internal Assessment marks are not included.
                </p>
              </div>
            )}
            {chaptersLoading && (
              <div className="text-neon-blue flex items-center justify-center gap-2 py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-neon-blue"></div>
                Loading chapters...
              </div>
            )}
            {chaptersError && (
              <div className="text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20">{chaptersError}</div>
            )}
            {!chaptersLoading && !chaptersError && aiChapters.length === 0 && (
              <div className="text-gray-400 text-center py-8">
                Select a subject and class to load chapters.
              </div>
            )}
            {aiChapters.map((unit) => (
              <div
                key={unit.unit}
                className="mb-3 bg-black/40 rounded-xl border border-white/10 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-white text-base">
                    {unit.unit}
                  </span>
                  <span className="text-xs font-mono bg-neon-blue/20 text-neon-blue px-2 py-1 rounded">
                    {unit.weightage} Marks
                  </span>
                </div>
                {/* Chapters directly under unit */}
                {unit.chapters && unit.chapters.length > 0 && (
                  <div className="space-y-2 ml-2">
                    {unit.chapters.map((ch) => (
                      <label
                        key={ch.name}
                        className="flex items-start gap-3 bg-white/5 rounded-lg p-3 cursor-pointer hover:bg-white/10 transition border border-transparent hover:border-white/10"
                      >
                        <input
                          type="checkbox"
                          checked={selectedChapters.includes(ch.name)}
                          onChange={(e) => {
                            if (e.target.checked)
                              setSelectedChapters([
                                ...selectedChapters,
                                ch.name,
                              ]);
                            else
                              setSelectedChapters(
                                selectedChapters.filter((c) => c !== ch.name),
                              );
                          }}
                          className="mt-1 w-4 h-4 rounded border-gray-500 text-neon-blue focus:ring-neon-blue bg-gray-800"
                        />
                        <div>
                          <span className="font-medium text-gray-200 block">
                            {ch.name}
                          </span>
                          {ch.clo && <span className="text-xs text-gray-500 block mt-0.5">
                            {ch.clo}
                          </span>}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {/* Subunits and their chapters */}
                {unit.subunits && unit.subunits.map((sub) => (
                  <div key={sub.subunit} className="mt-3 ml-2 border-l-2 border-white/10 pl-3">
                    <div className="text-sm font-semibold text-gray-400 mb-2">{sub.subunit}</div>
                    <div className="space-y-2">
                      {sub.chapters.map((ch) => (
                        <label
                          key={ch.name}
                          className="flex items-start gap-3 bg-white/5 rounded-lg p-3 cursor-pointer hover:bg-white/10 transition border border-transparent hover:border-white/10"
                        >
                          <input
                            type="checkbox"
                            checked={selectedChapters.includes(ch.name)}
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedChapters([
                                  ...selectedChapters,
                                  ch.name,
                                ]);
                              else
                                setSelectedChapters(
                                  selectedChapters.filter((c) => c !== ch.name),
                                );
                            }}
                            className="mt-1 w-4 h-4 rounded border-gray-500 text-neon-blue focus:ring-neon-blue bg-gray-800"
                          />
                          <div>
                            <span className="font-medium text-gray-200 block">
                              {ch.name}
                            </span>
                            {ch.clo && <span className="text-xs text-gray-500 block mt-0.5">
                              {ch.clo}
                            </span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-neon-yellow" />
              Exam Parameters
            </h3>

            <div className="space-y-5">
              <div>
                <label className="block mb-2 font-semibold text-gray-300">
                  Difficulty Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["Easy", "Medium", "Hard"].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`py-2 rounded-lg font-medium transition-all duration-200 ${difficulty === d
                        ? "bg-neon-blue text-black shadow-lg shadow-neon-blue/20"
                        : "bg-black/40 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10"
                        }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-2 font-semibold text-gray-300">
                  Question Types
                </label>
                <div className="space-y-2 bg-black/40 p-4 rounded-xl border border-white/10">
                  {SECTION_TYPES.map((type) => (
                    <label key={type.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSections.includes(type.value)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setSelectedSections([
                              ...selectedSections,
                              type.value,
                            ]);
                          else
                            setSelectedSections(
                              selectedSections.filter((s) => s !== type.value),
                            );
                        }}
                        className="w-5 h-5 rounded border-gray-500 text-neon-green focus:ring-neon-green bg-gray-800"
                      />
                      <span className="text-gray-200">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-2 font-semibold text-gray-300">
                  Total Marks
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={customMarks}
                    onChange={(e) => setCustomMarks(Number(e.target.value))}
                    disabled={!useCustomMarks}
                    className={`w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none ${!useCustomMarks ? 'opacity-50' : ''}`}
                  />
                  <label className="flex items-center gap-2 whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomMarks}
                      onChange={(e) => setUseCustomMarks(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-500 text-neon-blue focus:ring-neon-blue bg-gray-800"
                    />
                    <span className="text-gray-300 text-sm">Custom</span>
                  </label>
                </div>
                {!useCustomMarks && (
                  <p className="text-xs text-gray-500 mt-2">
                    Using standard marks for Class {selectedClass} {selectedSubject}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-4">
            <button
              className="flex-1 bg-white/5 hover:bg-white/10 text-white font-semibold py-3 px-6 rounded-xl border border-white/10 transition-all"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              className="flex-1 bg-gradient-to-r from-neon-purple to-pink-600 hover:from-neon-purple/80 hover:to-pink-600/80 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-neon-purple/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={selectedChapters.length === 0 || selectedSections.length === 0}
              onClick={() => {
                setStep(3);
                generatePaper();
              }}
            >
              Generate Paper
              <Zap className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const generatePaper = async () => {
    setAssembling(true);
    setQuestions([]);
    try {
      // Prepare weightage data
      const relevantUnits = aiChapters.filter(unit =>
        unit.chapters?.some(ch => selectedChapters.includes(ch.name)) ||
        unit.subunits?.some(sub => sub.chapters.some(ch => selectedChapters.includes(ch.name)))
      ).map(unit => ({
        unit: unit.unit,
        weightage: unit.weightage,
        chapters: [
          ...(unit.chapters?.map(c => c.name) || []),
          ...(unit.subunits?.flatMap(s => s.chapters.map(c => c.name)) || [])
        ]
      }));

      // Use client-side RAG generation for best quality
      const paper = await generatePaperWithRAG({
        classLevel: selectedClass,
        subject: selectedSubject,
        chapters: selectedChapters,
        difficulty: difficulty,
        totalMarks: customMarks,
        sections: selectedSections,
        // If using custom marks, disable strict weightage enforcement to avoid contradictions
        chapterWeightage: useCustomMarks ? undefined : relevantUnits
      });

      if (paper && paper.questions) {
        setQuestions(paper.questions);
      }
    } catch (err) {
      console.error("Paper generation failed:", err);
      // Fallback or error handling
      setChaptersError("Failed to generate paper. Please try again.");
    } finally {
      setAssembling(false);
    }
  };

  const renderStep3 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
          <CheckCircle className="w-8 h-8 text-neon-green" />
          Preview & Start
        </h2>
        <p className="text-gray-400">Review your generated paper before starting</p>
      </div>

      {assembling ? (
        <div className="glass-panel p-12 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-neon-blue mb-6"></div>
          <h3 className="text-xl font-bold text-white mb-2">Generating Your Exam Paper...</h3>
          <p className="text-gray-400 max-w-md">
            Our AI is assembling questions based on the latest CBSE patterns, selected chapters, and difficulty level.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/10 max-h-[600px] overflow-y-auto custom-scrollbar" ref={previewRef}>
              <div className="text-center border-b border-white/10 pb-6 mb-6">
                <h1 className="text-2xl font-bold text-black dark:text-white uppercase tracking-wider mb-2">
                  CBSE {examType} Examination
                </h1>
                <div className="flex justify-center gap-6 text-sm font-medium text-gray-500 dark:text-gray-400">
                  <span>Class: {selectedClass}</span>
                  <span>Subject: {selectedSubject}</span>
                  <span>Max Marks: {customMarks}</span>
                  <span>Time: 3 Hours</span>
                </div>
              </div>

              {questions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No questions generated. Please try again.
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Group by section if needed, for now flat list */}
                  {questions.map((q, idx) => (
                    <div key={idx} className="relative">
                      <div className="flex gap-4">
                        <span className="font-bold text-neon-blue min-w-[2rem]">{idx + 1}.</span>
                        <div className="flex-1">
                          <div className="text-gray-800 dark:text-gray-200 mb-2">
                            {parseMathInline(q.question)}
                          </div>
                          {q.type === "mcq" && q.options && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 pl-2">
                              {q.options.map((opt: string, i: number) => (
                                <div key={i} className="flex gap-2 text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-semibold">({String.fromCharCode(65 + i)})</span>
                                  <span>{parseMathInline(opt)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="font-bold text-gray-500 dark:text-gray-500 text-sm whitespace-nowrap">
                          [{q.marks}]
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    navigate("/cbse-exam-session", {
                      state: {
                        questions,
                        selectedSubject,
                        totalMarks: customMarks,
                        useCustomMarks,
                      },
                    });
                  }}
                  className="w-full bg-neon-green hover:bg-neon-green/80 text-black font-bold py-3 px-4 rounded-xl shadow-lg shadow-neon-green/20 transition-all flex items-center justify-center gap-2"
                >
                  <Clock className="w-5 h-5" />
                  Start Exam Now
                </button>

                <button
                  onClick={handleExportPDF}
                  className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-3 px-4 rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download PDF
                </button>

                {isTeacher && (
                  <button
                    onClick={async () => {
                      setDocxDownloading(true);
                      setDocxError(null);
                      try {
                        const answers = await generateAnswerKeyWithGemini({
                          subject: selectedSubject,
                          classLevel: selectedClass,
                          questions,
                        });
                        await exportTeacherDocx({
                          subject: selectedSubject,
                          classLevel: selectedClass,
                          examType,
                          questions,
                          answers,
                        });
                      } catch (e: any) {
                        setDocxError(e.message);
                      } finally {
                        setDocxDownloading(false);
                      }
                    }}
                    disabled={docxDownloading}
                    className="w-full bg-neon-purple hover:bg-neon-purple/80 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-neon-purple/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {docxDownloading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        Teacher Pack (DOCX)
                      </>
                    )}
                  </button>
                )}
                {docxError && <p className="text-red-400 text-sm text-center">{docxError}</p>}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Exam Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Total Questions</span>
                  <span className="text-white font-medium">{questions.length}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Total Marks</span>
                  <span className="text-white font-medium">{customMarks}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Difficulty</span>
                  <span className="text-white font-medium">{difficulty}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Sections</span>
                  <span className="text-white font-medium">{selectedSections.length}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full text-gray-400 hover:text-white py-2 transition-colors text-sm"
            >
              Back to Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen relative p-4 md:p-8 animate-fade-in">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl -z-10"></div>

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Brain className="w-8 h-8 text-neon-blue" />
              CBSE Exam Simulator
            </h1>
            <p className="text-gray-400">Generate and practice with AI-powered CBSE papers</p>
          </div>

          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${activeTab === tab
                  ? "bg-neon-blue text-black shadow-lg shadow-neon-blue/20"
                  : "text-gray-400 hover:text-white"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "Exam Simulator" ? (
          <>
            {renderProgress()}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Clock className="w-6 h-6 text-neon-green" />
                Past Exam Results
              </h2>

              {resultsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
                </div>
              ) : savedResults.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  No past exams found. Start a new exam to see results here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/10">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Score</th>
                        <th className="px-4 py-3 font-medium">Questions</th>
                        <th className="px-4 py-3 font-medium">Weaknesses</th>
                        <th className="px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {savedResults.map((res) => (
                        <tr key={res.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-white">
                            {new Date(res.exam_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-neon-green font-mono font-bold">
                              {res.total_score} / {res.max_score}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {res.questions_count}
                          </td>
                          <td className="px-4 py-3 text-gray-400 max-w-xs truncate">
                            {res.student_weaknesses || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <button className="text-neon-blue hover:text-neon-blue/80 text-sm font-medium">
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CBSEExamSimulator;
