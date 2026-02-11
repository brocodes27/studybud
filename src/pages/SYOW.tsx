import React, { useState } from 'react';
import { AIStudyBuddy } from '../components/AIStudyBuddy';
import { FileUp, Youtube, ArrowLeft, Monitor, Globe, Sparkles, Brain, Play, List, Zap, Trash2, History, BookOpen, FileText, Eye, EyeOff } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { OpenAIService } from '../lib/openaiService';
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

            const response = await OpenAIService.getInstance().generateChatCompletion(prompt, "Syllabus Architect.");
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
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-neo-bg relative">
                {/* Ingestion Overlay */}
                {isIngesting && (
                    <div className="absolute inset-0 z-50 bg-neo-bg/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
                        <div className="w-24 h-24 bg-neo-secondary border-4 border-black shadow-[8px_8px_0px_0px_#000] flex items-center justify-center mb-8 animate-bounce">
                            <Brain className="w-12 h-12 text-black" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic mb-2">NEURAL_INGESTION_ACTIVE</h2>
                        <p className="text-black/60 font-bold uppercase tracking-widest text-sm mb-8">ATLAS is scanning and indexing source content...</p>

                        <div className="w-full max-w-md h-8 bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden relative">
                            <div
                                className="h-full bg-neo-accent transition-all duration-300 ease-out"
                                style={{ width: `${ingestionProgress}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center mix-blend-difference">
                                <span className="font-black text-xs text-white uppercase tracking-widest">{ingestionProgress}% COMPLETE</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="max-w-4xl w-full">
                    <div className="text-center mb-12">
                        <h1 className="text-6xl font-black uppercase tracking-tighter italic mb-4">SYOW_<span className="text-neo-accent">v1.0</span></h1>
                        <p className="text-xl font-bold uppercase tracking-widest text-black/60">Study Your Own Way: PDF | Link | YouTube</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <button
                            onClick={() => setContentType('pdf')}
                            className={`p-8 border-4 border-black transition-all ${contentType === 'pdf' ? 'bg-neo-accent shadow-none translate-x-1 translate-y-1' : 'bg-white shadow-[8px_8px_0px_0px_#000] hover:translate-y-[-4px]'}`}
                        >
                            <FileUp className="h-16 w-16 mx-auto mb-6" />
                            <h3 className="text-2xl font-black uppercase tracking-tight">PDF UPLOAD</h3>
                        </button>

                        <button
                            onClick={() => setContentType('link')}
                            className={`p-8 border-4 border-black transition-all ${contentType === 'link' ? 'bg-neo-secondary shadow-none translate-x-1 translate-y-1' : 'bg-white shadow-[8px_8px_0px_0px_#000] hover:translate-y-[-4px]'}`}
                        >
                            <Globe className="h-16 w-16 mx-auto mb-6" />
                            <h3 className="text-2xl font-black uppercase tracking-tight">WEB LINK</h3>
                        </button>

                        <button
                            onClick={() => setContentType('youtube')}
                            className={`p-8 border-4 border-black transition-all ${contentType === 'youtube' ? 'bg-neo-muted shadow-none translate-x-1 translate-y-1' : 'bg-white shadow-[8px_8px_0px_0px_#000] hover:translate-y-[-4px]'}`}
                        >
                            <Youtube className="h-16 w-16 mx-auto mb-6 text-red-600" />
                            <h3 className="text-2xl font-black uppercase tracking-tight">YOUTUBE</h3>
                        </button>
                    </div>

                    {contentType && (
                        <div className="mt-12 bg-white border-4 border-black p-8 shadow-[12px_12px_0px_0px_#000] animate-in slide-in-from-bottom-6">
                            <h2 className="text-3xl font-black uppercase italic mb-6">Initialize {contentType.toUpperCase()} Source</h2>

                            {contentType === 'pdf' ? (
                                <div className="flex flex-col gap-4">
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                                        className="w-full bg-neo-bg border-4 border-black p-4 font-bold text-xl cursor-pointer"
                                    />
                                    {pdfFile && <p className="font-black text-neo-accent uppercase">FILE DETECTED: {pdfFile.name}</p>}
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={tempSource}
                                    onChange={(e) => setTempSource(e.target.value)}
                                    placeholder={`PASTE ${contentType.toUpperCase()} URL HERE...`}
                                    className="w-full bg-neo-bg border-4 border-black p-4 text-2xl font-black placeholder-black/20 focus:outline-none"
                                />
                            )}

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setContentType(null)}
                                    className="mt-6 bg-white text-black border-4 border-black p-6 font-black text-2xl uppercase tracking-widest hover:bg-neo-bg transition-all"
                                >
                                    CANCEL
                                </button>
                                <button
                                    onClick={handleStartStudy}
                                    disabled={contentType === 'pdf' ? !pdfFile : !tempSource}
                                    className="flex-1 mt-6 bg-black text-white p-6 font-black text-2xl uppercase tracking-widest hover:bg-neo-accent hover:text-black transition-all disabled:opacity-50"
                                >
                                    START NEURAL SESSION
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Recent Sessions UI */}
                    {!contentType && sessions.length > 0 && (
                        <div className="mt-16 w-full max-w-4xl mx-auto">
                            <div className="flex items-center gap-3 mb-6">
                                <History className="w-8 h-8" />
                                <h2 className="text-4xl font-black uppercase tracking-tighter italic">RECENT_SESSIONS</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {sessions.map(s => (
                                    <div
                                        key={s.id}
                                        onClick={() => loadSession(s)}
                                        className="group bg-white border-4 border-black p-4 flex items-center justify-between cursor-pointer hover:bg-neo-accent transition-all hover:translate-x-1 shadow-[4px_4px_0px_0px_#000] hover:shadow-none"
                                    >
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className="p-2 bg-black text-white shrink-0">
                                                {s.contentType === 'pdf' ? <FileUp className="w-5 h-5" /> : s.contentType === 'youtube' ? <Youtube className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                                            </div>
                                            <div className="overflow-hidden">
                                                <h3 className="font-black uppercase text-sm truncate">{s.title || 'Untitled Session'}</h3>
                                                <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest">
                                                    {new Date(s.timestamp).toLocaleDateString()} • {s.chapters.length} UNITS
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => deleteSession(e, s.id)}
                                            className="p-2 hover:bg-red-500 hover:text-white transition-colors"
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
        <div className="h-[calc(100vh-100px)] flex flex-col bg-neo-bg overflow-hidden border-2 border-black m-2 shadow-[8px_8px_0px_0px_#000]">
            {/* Header Bar */}
            <div className="bg-black text-white p-3 flex items-center justify-between border-b-2 border-neo-accent">
                <div className="flex items-center gap-4">
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
                                // Using the default user key for now
                                localStorage.removeItem(`syow_session_history_default_user`);
                            }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-neo-accent text-black hover:bg-white border-2 border-black transition-all shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-none"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase">New Session</span>
                    </button>
                    <button
                        onClick={() => {
                            setMode('select');
                            setContentType(null);
                            setSource('');
                            setTempSource('');
                            setPdfFile(null);
                        }}
                        className="p-1 hover:bg-white/20 transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Monitor className="h-5 w-5 text-neo-secondary" />
                        <h2 className="text-base font-black tracking-tight uppercase italic mt-0.5">SYOW_SESSION: <span className="text-neo-accent">{contentType?.toUpperCase()}</span></h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-neo-secondary/10 border border-neo-secondary">
                        <Sparkles className="h-3.5 w-3.5 text-neo-secondary animate-pulse" />
                        <span className="text-[10px] font-black tracking-widest text-neo-secondary">FEYNMAN_ACTIVE</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANE: SOURCE or NOTES */}
                <div className="flex-1 bg-white border-r-2 border-black flex flex-col relative">
                    {/* View Switcher Header */}
                    <div className="flex border-b-2 border-black bg-neo-bg">
                        <button
                            onClick={() => setLeftView('source')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-xs font-black uppercase tracking-widest transition-all ${leftView === 'source' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
                        >
                            <Monitor className="w-4 h-4" />
                            RESOURCE_VIEW
                        </button>
                        <button
                            onClick={() => setLeftView('notes')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-xs font-black uppercase tracking-widest transition-all ${leftView === 'notes' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
                        >
                            <FileText className="w-4 h-4" />
                            SESSION_NOTES
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
                            <div className="h-full flex flex-col bg-neo-bg p-6 overflow-hidden">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-6 h-6 text-neo-accent" />
                                        <h2 className="text-2xl font-black uppercase italic tracking-tight">SESSION_NOTES</h2>
                                    </div>
                                    <button
                                        onClick={() => setNotesViewMode(prev => prev === 'edit' ? 'preview' : 'edit')}
                                        className="px-4 py-2 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:bg-neo-accent hover:text-black transition-all flex items-center gap-2 text-xs font-black"
                                    >
                                        {notesViewMode === 'edit' ? <><Eye className="w-4 h-4" /> PREVIEW</> : <><EyeOff className="w-4 h-4" /> EDIT</>}
                                    </button>
                                </div>

                                <div className="flex-1 bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000] p-6 overflow-hidden flex flex-col">
                                    {notesViewMode === 'edit' ? (
                                        <textarea
                                            value={notes}
                                            onChange={(e) => {
                                                const newNotes = e.target.value;
                                                setNotes(newNotes);
                                                // Sync with session object
                                                if (activeSessionId) {
                                                    const session = sessions.find(s => s.id === activeSessionId);
                                                    if (session) saveSession({ ...session, notes: newNotes });
                                                }
                                            }}
                                            placeholder="Capture insights, formulas, and key takeaways from this resource... ATLAS can see these too! (Supports Markdown & LaTeX)"
                                            className="w-full h-full bg-transparent resize-none focus:outline-none font-bold text-lg leading-relaxed placeholder-black/10"
                                        />
                                    ) : (
                                        <div className="h-full overflow-y-auto prose prose-lg prose-black max-w-none custom-scrollbar pb-12">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkMath]}
                                                rehypePlugins={[rehypeKatex]}
                                            >
                                                {notes || "_No notes captured for this session yet._"}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-black/40 uppercase tracking-widest">
                                    <Sparkles className="w-3 h-3" />
                                    NOTES_ARE_PERSISTED_TO_STUDY_CONTEXT
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: AI STUDY BUDDY & VOICE LECTURES */}
                <div className="w-[550px] lg:w-[650px] xl:w-[750px] border-l-4 border-black flex flex-col bg-white overflow-hidden shadow-[-8px_0px_0px_0px_rgba(0,0,0,0.1)]">
                    {/* SYOW Modules Section */}
                    <div className="bg-neo-bg border-b-2 border-black p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-black uppercase italic flex items-center gap-2">
                                <List className="w-4 h-4 text-neo-accent" /> SYOW_UNITS
                            </h3>
                            {isGeneratingChapters && (
                                <div className="flex items-center gap-2 animate-pulse">
                                    <div className="w-2 h-2 bg-neo-accent rounded-full" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neo-accent">BIFURCATING...</span>
                                </div>
                            )}
                        </div>

                        {chapters.length > 0 ? (
                            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                {chapters.map((chapter, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => startLecture(chapter.title, chapter.description)}
                                        className="group bg-white border-2 border-black p-2 flex items-center justify-between hover:bg-neo-accent transition-all hover:translate-x-1"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 bg-black text-white flex items-center justify-center text-[10px] font-black">
                                                {idx + 1}
                                            </div>
                                            <div className="text-left">
                                                <h4 className="text-[11px] font-black uppercase truncate max-w-[200px]">{chapter.title}</h4>
                                                <p className="text-[9px] font-bold text-black/50 uppercase truncate max-w-[200px]">{chapter.description}</p>
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Play className="w-4 h-4 fill-black" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-black/5 border-2 border-black border-dashed p-4 text-center">
                                <p className="text-[10px] font-bold uppercase text-black/40 mb-2">No units generated yet.</p>
                                <button
                                    onClick={() => generateChapters(extractedContent)}
                                    disabled={!extractedContent || isGeneratingChapters}
                                    className="text-[10px] font-black uppercase bg-black text-white px-3 py-1 hover:bg-neo-accent hover:text-black transition-colors disabled:opacity-50"
                                >
                                    {isGeneratingChapters ? 'WORKING...' : 'RE-BIFURCATE CONTENT'}
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
