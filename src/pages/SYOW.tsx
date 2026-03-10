import React, { useState } from 'react';
import { AIStudyBuddy } from '../components/AIStudyBuddy';
import { FileUp, Youtube, ArrowLeft, Monitor, Globe, Sparkles, Brain, Play, List, Zap, Trash2, History, BookOpen, FileText, Eye, EyeOff } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import AIService from '../lib/aiService';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface SYOWSession {
    id: string;
    timestamp: number;
    title: string;
    contentType: 'pdf' | 'link' | 'youtube';
    source: string;
    extractedContent: string;
    chapters: { title: string, description: string }[];
    notes?: string;
}

// Set worker source for PDF.js
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

export default function SYOW() {
    const [mode, setMode] = useState<'select' | 'study'>(() => (localStorage.getItem('syow_mode') as any) || 'select');
    const [activeSessionId, setActiveSessionId] = useState<string | null>(() => localStorage.getItem('syow_active_id'));
    const [contentType, setContentType] = useState<'pdf' | 'link' | 'youtube' | null>(null);
    const [source, setSource] = useState<string>('');
    const [tempSource, setTempSource] = useState<string>('');
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [isIngesting, setIsIngesting] = useState(false);
    const [ingestionProgress, setIngestionProgress] = useState(0);
    const [extractedContent, setExtractedContent] = useState<string>('');
    const [chapters, setChapters] = useState<{ title: string, description: string }[]>([]);
    const [isGeneratingChapters, setIsGeneratingChapters] = useState(false);
    const [leftView, setLeftView] = useState<'source' | 'notes'>('source');
    const [notes, setNotes] = useState<string>('');
    const [notesViewMode, setNotesViewMode] = useState<'edit' | 'preview'>('edit');
    const [sessions, setSessions] = useState<SYOWSession[]>(() => {
        const saved = localStorage.getItem('syow_sessions');
        return saved ? JSON.parse(saved) : [];
    });

    // Check for preselected type from dashboard
    React.useEffect(() => {
        const preselect = localStorage.getItem('syow_preselect_type');
        if (preselect) {
            setContentType(preselect as any);
            localStorage.removeItem('syow_preselect_type');
        }
    }, []);

    // Load active session on mount
    React.useEffect(() => {
        if (activeSessionId && mode === 'study') {
            const session = sessions.find(s => s.id === activeSessionId);
            if (session) {
                setContentType(session.contentType);
                setSource(session.source);
                setExtractedContent(session.extractedContent);
                setChapters(session.chapters);
                setNotes(session.notes || '');
            }
        }
    }, [activeSessionId, mode]);

    // Persist active session reference
    React.useEffect(() => {
        localStorage.setItem('syow_mode', mode);
        if (activeSessionId) localStorage.setItem('syow_active_id', activeSessionId);
    }, [mode, activeSessionId]);

    // Save/Update sessions list
    const saveSession = (session: SYOWSession) => {
        const index = sessions.findIndex(s => s.id === session.id);
        let newSessions = [...sessions];
        if (index !== -1) {
            newSessions[index] = session;
        } else {
            newSessions = [session, ...newSessions];
        }
        setSessions(newSessions);
        localStorage.setItem('syow_sessions', JSON.stringify(newSessions));
    };

    const deleteSession = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newSessions = sessions.filter(s => s.id !== id);
        setSessions(newSessions);
        localStorage.setItem('syow_sessions', JSON.stringify(newSessions));
        if (activeSessionId === id) {
            setMode('select');
            setActiveSessionId(null);
        }
    };

    const loadSession = (session: SYOWSession) => {
        setActiveSessionId(session.id);
        setContentType(session.contentType);
        setSource(session.source);
        setExtractedContent(session.extractedContent);
        setChapters(session.chapters);
        setNotes(session.notes || '');
        setMode('study');
    };

    const generateChapters = async (content: string, sessionId?: string) => {
        setIsGeneratingChapters(true);
        try {
            const prompt = `Based on the following study content, break it down into 3-5 logical "Study Units" or "Chapters". 
            Each unit should be a specific concept from the text.
            Return ONLY a JSON array of objects with 'title' and 'description' keys.
            
            CONTENT:
            ${content.slice(0, 5000)}`; // Slice to avoid context limits

            const response = await AIService.getInstance().generateChatCompletion(prompt, "Syllabus Architect.");
            const start = response.indexOf('[');
            const end = response.lastIndexOf(']');
            if (start !== -1 && end !== -1) {
                const parsed = JSON.parse(response.slice(start, end + 1));
                setChapters(parsed);

                // Update session with chapters
                const sId = sessionId || activeSessionId;
                if (sId) {
                    const session = sessions.find(s => s.id === sId);
                    if (session) {
                        saveSession({ ...session, chapters: parsed });
                    }
                }
            }
        } catch (e) {
            console.error('Failed to generate chapters', e);
        } finally {
            setIsGeneratingChapters(false);
        }
    };

    const ingestPDF = async (file: File) => {
        setIsIngesting(true);
        setIngestionProgress(10);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            const totalPages = pdf.numPages;

            for (let i = 1; i <= totalPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
                setIngestionProgress(10 + Math.floor((i / totalPages) * 80));
            }
            setExtractedContent(fullText);
            setIngestionProgress(100);
            return { fullText };
        } catch (e) {
            console.error('PDF ingestion failed', e);
            return null;
        } finally {
            setTimeout(() => setIsIngesting(false), 500);
        }
    };

    const ingestLink = async (url: string) => {
        setIsIngesting(true);
        setIngestionProgress(20);
        try {
            const jinaUrl = `https://r.jina.ai/${url}`;
            const response = await fetch(jinaUrl);
            if (!response.ok) throw new Error('Jina Reader failed');
            const markdown = await response.text();
            setExtractedContent(markdown);
            setIngestionProgress(100);
            return { fullText: markdown };
        } catch (e) {
            console.error('Link ingestion failed', e);
            const fallback = `Study content from: ${url}`;
            setExtractedContent(fallback);
            return { fullText: fallback };
        } finally {
            setTimeout(() => setIsIngesting(false), 500);
        }
    };

    const handleStartStudy = async () => {
        let result: { fullText: string } | null = null;
        let finalSource = '';
        let title = '';

        if (contentType === 'pdf' && pdfFile) {
            result = await ingestPDF(pdfFile);
            finalSource = URL.createObjectURL(pdfFile);
            title = pdfFile.name;
        } else if (contentType === 'link' && tempSource) {
            result = await ingestLink(tempSource);
            finalSource = tempSource;
            title = tempSource.replace('https://', '').replace('www.', '').split('/')[0];
        } else if (contentType === 'youtube' && tempSource) {
            result = await ingestLink(tempSource);
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
            const match = tempSource.match(regExp);
            if (match && match[2].length === 11) {
                finalSource = `https://www.youtube.com/embed/${match[2]}`;
            } else {
                finalSource = tempSource;
            }
            title = 'YouTube Research';
        }

        if (result || contentType === 'youtube') {
            const newId = `syow_${Date.now()}`;
            const newSession: SYOWSession = {
                id: newId,
                timestamp: Date.now(),
                title: title,
                contentType: contentType as any,
                source: finalSource,
                extractedContent: result?.fullText || '',
                chapters: []
            };

            saveSession(newSession);
            setActiveSessionId(newId);
            setSource(finalSource);
            setMode('study');

            if (result?.fullText) {
                generateChapters(result.fullText, newId);
            }
        }
    };

    const startLecture = (chapterTitle: string, chapterDescription: string) => {
        window.dispatchEvent(new CustomEvent('trigger-atlas-chat', {
            detail: {
                message: `ATLAS, let's start a SYOW Voice Lecture on the unit: **"${chapterTitle}"**. \n\nUNIT_DESCRIPTION: ${chapterDescription}\n\nUse the Feynman protocol based on the source content we ingested.`,
                voice: true
            }
        }));
    };

    const getSystemContext = () => {
        const unitsList = chapters.map((c, i) => `${i + 1}. ${c.title}: ${c.description}`).join('\n');

        return `
STUDY_CONTEXT_SYOW:
The student is studying a specific resource: ${contentType?.toUpperCase()}
Source Identifier: ${tempSource || (pdfFile ? pdfFile.name : 'Unknown')}

BIFURCATED_SYLLABUS (UNITS):
${unitsList || 'No units generated yet.'}

FULL_RESOURCE_CONTENT:
${extractedContent || 'Content extraction in progress or failed.'}

INSTRUCTION: 
Your goal is to guide the student through this specific content using the Feynman Neural Teaching Protocol. 
Because you have the FULL CONTENT above, you should:
1. Reference specific sections, details, and facts from the text.
2. Ask probing questions based on the actual material.
3. Don't hallucinate facts not in the source, but do use your general knowledge to explain complexities found in the source.

When a student starts a lecture on a unit, focus DEEPLY on that unit's description and its relation to the full content.
`;
    };

    if (mode === 'select') {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 relative animate-fade-in">
                {/* Ingestion Overlay */}
                {isIngesting && (
                    <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-8">
                        <div className="w-16 h-16 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[20px] flex items-center justify-center mb-6 shadow-float-cyan animate-bounce">
                            <Brain className="w-8 h-8 text-[#00D1FF]" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-[#0A192F] tracking-tight mb-2">Analyzing content...</h2>
                        <p className="text-[#64748B] font-medium mb-8">Atlas is scanning and indexing your source</p>

                        <div className="w-full max-w-md h-3 bg-[#F8FAFF] border border-[#0A192F]/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#00D1FF] rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${ingestionProgress}%` }}
                            />
                        </div>
                        <p className="text-sm font-bold text-[#64748B] mt-3">{ingestionProgress}% complete</p>
                    </div>
                )}

                <div className="max-w-4xl w-full">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D1FF]/10 text-[#00D1FF] rounded-full font-bold text-sm border border-[#00D1FF]/20 mb-4">
                            <Sparkles className="w-4 h-4" />
                            <span>Study Your Own Way</span>
                        </div>
                        <h1 className="text-4xl font-extrabold text-[#0A192F] tracking-tight">Upload your material, study with Atlas</h1>
                        <p className="text-[#64748B] font-medium mt-2">PDF • Web Link • YouTube</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <button
                            onClick={() => setContentType('pdf')}
                            className={`neo-card text-center transition-all ${contentType === 'pdf' ? 'border-[#00D1FF] shadow-float-cyan' : 'hover:-translate-y-1'}`}
                        >
                            <div className={`w-14 h-14 rounded-[16px] flex items-center justify-center mx-auto mb-4 transition-all ${contentType === 'pdf' ? 'bg-[#00D1FF]/20 text-[#00D1FF]' : 'bg-[#F8FAFF] text-[#64748B]'}`}>
                                <FileUp className="h-7 w-7 stroke-[2px]" />
                            </div>
                            <h3 className="text-lg font-extrabold text-[#0A192F] tracking-tight">PDF Upload</h3>
                            <p className="text-sm text-[#64748B] font-medium mt-1">Upload a PDF document</p>
                        </button>

                        <button
                            onClick={() => setContentType('link')}
                            className={`neo-card text-center transition-all ${contentType === 'link' ? 'border-[#00D1FF] shadow-float-cyan' : 'hover:-translate-y-1'}`}
                        >
                            <div className={`w-14 h-14 rounded-[16px] flex items-center justify-center mx-auto mb-4 transition-all ${contentType === 'link' ? 'bg-[#00D1FF]/20 text-[#00D1FF]' : 'bg-[#F8FAFF] text-[#64748B]'}`}>
                                <Globe className="h-7 w-7 stroke-[2px]" />
                            </div>
                            <h3 className="text-lg font-extrabold text-[#0A192F] tracking-tight">Web Link</h3>
                            <p className="text-sm text-[#64748B] font-medium mt-1">Paste any web URL</p>
                        </button>

                        <button
                            onClick={() => setContentType('youtube')}
                            className={`neo-card text-center transition-all ${contentType === 'youtube' ? 'border-[#00D1FF] shadow-float-cyan' : 'hover:-translate-y-1'}`}
                        >
                            <div className={`w-14 h-14 rounded-[16px] flex items-center justify-center mx-auto mb-4 transition-all ${contentType === 'youtube' ? 'bg-red-50 text-red-500' : 'bg-[#F8FAFF] text-[#64748B]'}`}>
                                <Youtube className="h-7 w-7 stroke-[2px]" />
                            </div>
                            <h3 className="text-lg font-extrabold text-[#0A192F] tracking-tight">YouTube</h3>
                            <p className="text-sm text-[#64748B] font-medium mt-1">Paste a YouTube URL</p>
                        </button>
                    </div>

                    {contentType && (
                        <div className="mt-8 neo-card animate-fade-in">
                            <h2 className="text-xl font-extrabold text-[#0A192F] tracking-tight mb-5">
                                {contentType === 'pdf' ? 'Upload PDF' : contentType === 'link' ? 'Paste Web URL' : 'Paste YouTube URL'}
                            </h2>

                            {contentType === 'pdf' ? (
                                <div className="flex flex-col gap-3">
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                                        className="neo-input w-full p-3 cursor-pointer text-sm"
                                    />
                                    {pdfFile && <p className="font-bold text-[#34D399] text-sm">File selected: {pdfFile.name}</p>}
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={tempSource}
                                    onChange={(e) => setTempSource(e.target.value)}
                                    placeholder={`Paste ${contentType === 'youtube' ? 'YouTube' : 'web'} URL here...`}
                                    className="neo-input w-full p-4 text-base"
                                />
                            )}

                            <div className="flex gap-3 mt-5">
                                <button
                                    onClick={() => setContentType(null)}
                                    className="px-6 py-3 rounded-[14px] border-2 border-[#0A192F]/10 text-[#64748B] font-bold hover:border-[#0A192F]/20 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleStartStudy}
                                    disabled={contentType === 'pdf' ? !pdfFile : !tempSource}
                                    className="flex-1 neo-button py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Start Study Session
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Recent Sessions UI */}
                    {!contentType && sessions.length > 0 && (
                        <div className="mt-12 w-full">
                            <div className="flex items-center gap-3 mb-5">
                                <History className="w-5 h-5 text-[#64748B]" />
                                <h2 className="text-xl font-extrabold text-[#0A192F] tracking-tight">Recent Sessions</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {sessions.map(s => (
                                    <div
                                        key={s.id}
                                        onClick={() => loadSession(s)}
                                        className="neo-card flex items-center justify-between cursor-pointer hover:-translate-y-0.5 transition-all group"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-10 h-10 rounded-[12px] bg-[#00D1FF]/10 border border-[#00D1FF]/20 text-[#00D1FF] flex items-center justify-center shrink-0">
                                                {s.contentType === 'pdf' ? <FileUp className="w-5 h-5" /> : s.contentType === 'youtube' ? <Youtube className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                                            </div>
                                            <div className="overflow-hidden">
                                                <h3 className="font-extrabold text-[#0A192F] text-sm truncate">{s.title || 'Untitled Session'}</h3>
                                                <p className="text-xs font-medium text-[#64748B]">
                                                    {new Date(s.timestamp).toLocaleDateString()} · {s.chapters.length} units
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => deleteSession(e, s.id)}
                                            className="p-2 rounded-[10px] text-[#64748B] hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col bg-white overflow-hidden border-2 border-[#0A192F]/5 rounded-[24px] m-2 shadow-float-cyan">
            {/* Header Bar */}
            <div className="bg-[#F8FAFF] border-b-2 border-[#0A192F]/5 p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (window.confirm("Start a new session? Your current progress and chat will be cleared.")) {
                                setMode('select');
                                setContentType(null);
                                setSource('');
                                setTempSource('');
                                setPdfFile(null);
                                setExtractedContent('');
                                setChapters([]);
                                localStorage.removeItem('syow_mode');
                                localStorage.removeItem('syow_contentType');
                                localStorage.removeItem('syow_source');
                                localStorage.removeItem('syow_content');
                                localStorage.removeItem('syow_chapters');
                                localStorage.removeItem(`syow_session_history_default_user`);
                            }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 neo-button text-xs"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        <span>New Session</span>
                    </button>
                    <button
                        onClick={() => {
                            setMode('select');
                            setContentType(null);
                            setSource('');
                            setTempSource('');
                            setPdfFile(null);
                        }}
                        className="p-1.5 text-[#64748B] hover:text-[#0A192F] transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-[#00D1FF]" />
                        <h2 className="text-sm font-extrabold text-[#0A192F] tracking-tight">SYOW — <span className="text-[#00D1FF]">{contentType?.toUpperCase()}</span></h2>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[#34D399]/10 border border-[#34D399]/20 rounded-full">
                        <Sparkles className="h-3 w-3 text-[#34D399] animate-pulse" />
                        <span className="text-[10px] font-bold text-[#34D399]">Feynman Active</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANE: SOURCE or NOTES */}
                <div className="flex-1 bg-white border-r-2 border-[#0A192F]/5 flex flex-col relative">
                    {/* View Switcher Header */}
                    <div className="flex border-b-2 border-[#0A192F]/5 bg-[#F8FAFF]">
                        <button
                            onClick={() => setLeftView('source')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold transition-all ${leftView === 'source' ? 'text-[#00D1FF] border-b-2 border-[#00D1FF]' : 'text-[#64748B] hover:text-[#0A192F]'}`}
                        >
                            <Monitor className="w-3.5 h-3.5" />
                            Resource View
                        </button>
                        <button
                            onClick={() => setLeftView('notes')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold transition-all ${leftView === 'notes' ? 'text-[#00D1FF] border-b-2 border-[#00D1FF]' : 'text-[#64748B] hover:text-[#0A192F]'}`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Session Notes
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        {leftView === 'source' ? (
                            contentType === 'youtube' ? (
                                <iframe
                                    src={source}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : contentType === 'link' ? (
                                <iframe
                                    src={source}
                                    className="w-full h-full"
                                    title="Content Viewer"
                                />
                            ) : (
                                <embed
                                    src={source}
                                    type="application/pdf"
                                    className="w-full h-full"
                                />
                            )
                        ) : (
                            <div className="h-full flex flex-col bg-[#F8FAFF] p-5 overflow-hidden">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-5 h-5 text-[#00D1FF]" />
                                        <h2 className="text-lg font-extrabold text-[#0A192F] tracking-tight">Session Notes</h2>
                                    </div>
                                    <button
                                        onClick={() => setNotesViewMode(prev => prev === 'edit' ? 'preview' : 'edit')}
                                        className="px-3 py-1.5 rounded-[10px] border-2 border-[#0A192F]/10 text-[#64748B] hover:border-[#00D1FF]/30 hover:text-[#00D1FF] transition-all flex items-center gap-1.5 text-xs font-bold"
                                    >
                                        {notesViewMode === 'edit' ? <><Eye className="w-3.5 h-3.5" /> Preview</> : <><EyeOff className="w-3.5 h-3.5" /> Edit</>}
                                    </button>
                                </div>

                                <div className="flex-1 bg-white border-2 border-[#0A192F]/5 rounded-[16px] p-5 overflow-hidden flex flex-col">
                                    {notesViewMode === 'edit' ? (
                                        <textarea
                                            value={notes}
                                            onChange={(e) => {
                                                const newNotes = e.target.value;
                                                setNotes(newNotes);
                                                if (activeSessionId) {
                                                    const session = sessions.find(s => s.id === activeSessionId);
                                                    if (session) saveSession({ ...session, notes: newNotes });
                                                }
                                            }}
                                            placeholder="Capture insights, formulas, and key takeaways... Atlas can see these too! (Supports Markdown & LaTeX)"
                                            className="w-full h-full bg-transparent resize-none focus:outline-none font-medium text-sm leading-relaxed placeholder-[#64748B]/40 text-[#0A192F]"
                                        />
                                    ) : (
                                        <div className="h-full overflow-y-auto prose prose-sm max-w-none custom-scrollbar pb-8 text-[#0A192F]">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkMath]}
                                                rehypePlugins={[rehypeKatex]}
                                            >
                                                {notes || "_No notes captured for this session yet._"}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[#64748B]">
                                    <Sparkles className="w-3 h-3 text-[#00D1FF]" />
                                    Notes are visible to Atlas in chat
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: AI STUDY BUDDY & VOICE LECTURES */}
                <div className="w-[550px] lg:w-[650px] xl:w-[750px] border-l-2 border-[#0A192F]/5 flex flex-col bg-[#F8FAFF] overflow-hidden">
                    {/* SYOW Modules Section */}
                    <div className="bg-white border-b-2 border-[#0A192F]/5 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-extrabold text-[#0A192F] tracking-tight flex items-center gap-2">
                                <List className="w-4 h-4 text-[#00D1FF]" /> Study Units
                            </h3>
                            {isGeneratingChapters && (
                                <div className="flex items-center gap-2 animate-pulse">
                                    <div className="w-2 h-2 bg-[#00D1FF] rounded-full" />
                                    <span className="text-[10px] font-bold text-[#00D1FF]">Generating...</span>
                                </div>
                            )}
                        </div>

                        {chapters.length > 0 ? (
                            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                                {chapters.map((chapter, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => startLecture(chapter.title, chapter.description)}
                                        className="group bg-[#F8FAFF] border-2 border-[#0A192F]/5 rounded-[12px] p-2.5 flex items-center justify-between hover:border-[#00D1FF]/30 hover:bg-[#00D1FF]/5 transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 bg-[#00D1FF]/10 text-[#00D1FF] rounded-full flex items-center justify-center text-[10px] font-extrabold">
                                                {idx + 1}
                                            </div>
                                            <div className="text-left">
                                                <h4 className="text-xs font-extrabold text-[#0A192F] truncate max-w-[200px]">{chapter.title}</h4>
                                                <p className="text-[10px] font-medium text-[#64748B] truncate max-w-[200px]">{chapter.description}</p>
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Play className="w-4 h-4 text-[#00D1FF] fill-[#00D1FF]" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-[#F8FAFF] border-2 border-dashed border-[#0A192F]/5 rounded-[12px] p-4 text-center">
                                <p className="text-xs font-medium text-[#64748B] mb-2">No units generated yet.</p>
                                <button
                                    onClick={() => generateChapters(extractedContent)}
                                    disabled={!extractedContent || isGeneratingChapters}
                                    className="text-xs font-bold text-[#00D1FF] hover:underline disabled:opacity-50"
                                >
                                    {isGeneratingChapters ? 'Working...' : 'Generate Study Units'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        <AIStudyBuddy
                            title="SYOW_ATLAS"
                            subtitle="FEYNMAN_NEURAL_TEACHING"
                            variant="mentor"
                            storageNamespace={`syow_session_${activeSessionId || 'default'}`}
                            isolateContext={true}
                            hideMissionControl={true}
                            notes={notes}
                            onNotesChange={(v) => {
                                setNotes(v);
                                if (activeSessionId) {
                                    const session = sessions.find(s => s.id === activeSessionId);
                                    if (session) saveSession({ ...session, notes: v });
                                }
                            }}
                            extraContext={getSystemContext()}
                            welcomeContent={`I have initialized the **SYOW Feynman Protocol**. 🎯\n\nI can see you've loaded a ${contentType?.toUpperCase()} source. I've also bifurcated it into **${chapters.length} units**. \n\nClick a unit above to start a deep-dive voice lecture, or just start talking!`}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
