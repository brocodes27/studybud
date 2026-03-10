
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { guidedPaperService, GuidedPaper, GuidedQuestion, GuidedAttempt } from '../lib/guidedPaperService';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileText, CheckCircle, Lock,
    ChevronRight, Brain, Loader2, Sparkles,
    Clock, ChevronLeft
} from 'lucide-react';

export function GuidedPaperSolver() {
    const { user } = useAuth() as any;
    const [papers, setPapers] = useState<GuidedPaper[]>([]);
    const [selectedPaper, setSelectedPaper] = useState<GuidedPaper | null>(null);
    const [questions, setQuestions] = useState<GuidedQuestion[]>([]);
    const [attempts, setAttempts] = useState<Record<string, GuidedAttempt>>({});

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load Papers
    useEffect(() => {
        if (user) loadPapers();
    }, [user]);

    // Load Questions when Paper Selected
    useEffect(() => {
        if (selectedPaper) {
            loadQuestions(selectedPaper.id);
        }
    }, [selectedPaper]);

    const loadPapers = async () => {
        if (!user) return;
        setLoading(true);
        const { data } = await guidedPaperService.getPapers(user.id);
        setPapers(data);
        setLoading(false);
    };

    const loadQuestions = async (paperId: string) => {
        setLoading(true);
        const { data } = await guidedPaperService.getPaperQuestions(paperId);
        setQuestions(data);

        // Load attempts for these questions
        const newAttempts: Record<string, GuidedAttempt> = {};
        if (user) {
            for (const q of data) {
                const { data: attempt } = await guidedPaperService.getAttempt(user.id, q.id);
                if (attempt) newAttempts[q.id] = attempt;
            }
        }
        setAttempts(newAttempts);
        setLoading(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setUploading(true);
        try {
            const { data, error } = await guidedPaperService.uploadPaper(file, user.id);
            if (error) throw error;
            if (data) {
                setPapers([data, ...papers]);
                // Simulate waiting for processing
                // In real app, we'd poll or wait used Realtime, but here we just wait locally if needed
                // The service already triggers processing, so we can poll status
                await pollStatus(data.id);
            }
        } catch (err) {
            console.error(err);
            alert("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const pollStatus = async (paperId: string) => {
        // Simple polling
        let retries = 0;
        while (retries < 20) {
            await new Promise(r => setTimeout(r, 2000));
            const { data } = await guidedPaperService.getPapers(user.id); // Re-fetch list
            const updated = data.find(p => p.id === paperId);
            if (updated && updated.status === 'ready') {
                setPapers(data); // Update list
                setSelectedPaper(updated);
                break;
            }
            if (updated && updated.status === 'error') {
                alert("Processing failed");
                break;
            }
            retries++;
        }
    };

    // View: List of Papers
    if (!selectedPaper) {
        return (
            <div className="pb-20 animate-fade-in max-w-7xl mx-auto">
                <div className="mb-10 flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#34D399]/10 border border-[#34D399]/20 rounded-[20px] flex items-center justify-center">
                        <FileText className="h-7 w-7 text-[#34D399] stroke-[2px]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-[#0A192F] tracking-tight">Guided Paper Solver</h1>
                        <p className="text-[#64748B] font-medium">Upload exam papers. AI extracts questions and guides you with progressive hints.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="w-10 h-10 text-[#00D1FF] animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Upload Card */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="group cursor-pointer border-2 border-dashed border-[#0A192F]/10 bg-[#F8FAFF] rounded-[24px] h-64 flex flex-col items-center justify-center p-6 hover:border-[#00D1FF]/40 hover:bg-[#00D1FF]/5 transition-all duration-300"
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*,application/pdf"
                                onChange={handleFileUpload}
                            />
                            {uploading ? (
                                <div className="flex flex-col items-center">
                                    <Loader2 className="w-10 h-10 text-[#00D1FF] animate-spin mb-4" />
                                    <span className="text-[#00D1FF] font-bold text-sm">Extracting questions...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="w-14 h-14 bg-white border-2 border-[#0A192F]/5 rounded-[16px] flex items-center justify-center mb-4 group-hover:border-[#00D1FF]/30 group-hover:scale-110 transition-all shadow-float-cyan">
                                        <Upload className="w-7 h-7 text-[#64748B] group-hover:text-[#00D1FF]" />
                                    </div>
                                    <h3 className="text-lg font-extrabold text-[#0A192F] group-hover:text-[#00D1FF] transition-colors">Upload Paper</h3>
                                    <p className="text-sm text-[#64748B] mt-1 font-medium">PDF or Image</p>
                                </>
                            )}
                        </div>

                        {/* Paper List */}
                        {papers.map((paper) => (
                            <motion.div
                                key={paper.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => paper.status === 'ready' && setSelectedPaper(paper)}
                                className={`neo-card flex flex-col justify-between h-64 group transition-all duration-300 ${paper.status === 'ready' ? 'hover:-translate-y-1 hover:shadow-float-cyan cursor-pointer' : 'opacity-60'}`}
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-[12px] ${paper.status === 'ready' ? 'bg-[#00D1FF]/10 text-[#00D1FF]' : 'bg-amber-50 text-amber-500'}`}>
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        {paper.status === 'processing' && (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center gap-1">
                                                <Loader2 className="w-3 h-3 animate-spin" /> Processing
                                            </span>
                                        )}
                                        {paper.status === 'ready' && (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/20">
                                                Ready
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-extrabold text-[#0A192F] mb-2 line-clamp-2">{paper.title}</h3>
                                    <p className="text-sm text-[#64748B] font-medium">{new Date(paper.created_at).toLocaleDateString()}</p>
                                </div>

                                <div className="flex items-center text-sm font-bold text-[#64748B] group-hover:text-[#00D1FF] transition-colors">
                                    <span>{paper.status === 'ready' ? 'Start Solving' : 'Please wait...'}</span>
                                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // View: Solver Interface
    return (
        <div className="flex flex-col md:flex-row min-h-[calc(100vh-8rem)] bg-white rounded-[32px] border-2 border-[#0A192F]/5 overflow-hidden shadow-float-cyan">
            {/* Sidebar */}
            <div className="w-full md:w-72 border-r border-[#0A192F]/5 p-6 flex flex-col bg-[#F8FAFF] md:h-[calc(100vh-8rem)] sticky top-0">
                <button
                    onClick={() => setSelectedPaper(null)}
                    className="flex items-center text-[#64748B] hover:text-[#0A192F] mb-6 transition-colors font-bold text-sm"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back to Papers
                </button>

                <div className="mb-6">
                    <h2 className="text-lg font-extrabold text-[#0A192F] tracking-tight mb-3">{selectedPaper.title}</h2>
                    <div className="h-2 w-full bg-[#0A192F]/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[#00D1FF] rounded-full transition-all"
                            style={{ width: `${(Object.values(attempts).filter(a => a.is_solved).length / questions.length) * 100}%` }}
                        />
                    </div>
                    <p className="text-xs text-[#64748B] font-medium mt-2 flex justify-between">
                        <span>Progress</span>
                        <span>{Object.values(attempts).filter(a => a.is_solved).length} / {questions.length} Solved</span>
                    </p>
                </div>

                {/* Question Nav */}
                <div className="flex-1 overflow-y-auto space-y-2">
                    {questions.map((q) => {
                        const isSolved = attempts[q.id]?.is_solved;
                        const isWIP = attempts[q.id]?.current_hint_level > 0 && !isSolved;

                        return (
                            <a
                                key={q.id}
                                href={`#q-${q.id}`}
                                className={`block p-3 rounded-[12px] border-2 transition-all font-medium text-sm ${isSolved ? 'bg-[#34D399]/10 border-[#34D399]/20 text-[#34D399]' : isWIP ? 'bg-[#00D1FF]/10 border-[#00D1FF]/20 text-[#00D1FF]' : 'bg-white border-[#0A192F]/5 text-[#64748B] hover:border-[#0A192F]/10'}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span>Question {q.question_number}</span>
                                    {isSolved && <CheckCircle className="w-4 h-4" />}
                                    {isWIP && <Clock className="w-4 h-4" />}
                                </div>
                            </a>
                        )
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 md:p-10 overflow-y-auto">
                <div className="max-w-3xl mx-auto space-y-8 pb-16">
                    {questions.map((q) => (
                        <QuestionSolver
                            key={q.id}
                            question={q}
                            attempt={attempts[q.id]}
                            onHintUpdate={(newAttempt) => setAttempts(prev => ({ ...prev, [q.id]: newAttempt }))}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function QuestionSolver({ question, attempt, onHintUpdate }: { question: GuidedQuestion, attempt?: GuidedAttempt, onHintUpdate: (a: GuidedAttempt) => void }) {
    const [loadingHint, setLoadingHint] = useState(false);
    const [hints, setHints] = useState<string[]>([]);

    // Load hints initially
    useEffect(() => {
        const loadHints = async () => {
            if (!attempt) return;
            const loadedHints = [];
            for (let i = 1; i <= attempt.current_hint_level; i++) {
                const content = await guidedPaperService.getHint(question.id, i);
                if (content) loadedHints.push(content);
            }
            setHints(loadedHints);
        };
        loadHints();
    }, [attempt]);

    const handleUnlockHint = async () => {
        if (!attempt) {
            // First attempt creation if missing, handled by service generally but...
            // Actually getAttempt handles creation if missing.
            // If attempt is undefined here it means parent hasn't refreshed or error.
            // But we can just assume user ID is available in closure scope? No.
            // For simplicity, assume attempt exists (created at load time).
            return;
        }

        const nextLevel = attempt.current_hint_level + 1;
        if (nextLevel > 3) return;

        setLoadingHint(true);
        try {
            // Generate hint first
            const content = await guidedPaperService.generateHint(question.id, question.question_text, nextLevel);
            // Update DB
            const { data } = await guidedPaperService.unlockHint(attempt.id, attempt.current_hint_level);
            if (data) {
                onHintUpdate(data);
                setHints([...hints, content]);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to get hint");
        } finally {
            setLoadingHint(false);
        }
    };

    const isSolved = attempt?.is_solved;
    const hintsUsed = attempt?.current_hint_level || 0;

    return (
        <motion.div
            id={`q-${question.id}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="neo-card"
        >
            <div className="mb-5 flex justify-between items-start">
                <span className="font-bold text-[#00D1FF] text-sm bg-[#00D1FF]/10 px-4 py-1 rounded-full border border-[#00D1FF]/20">
                    Q{question.question_number}
                </span>
                {isSolved ? (
                    <span className="flex items-center text-[#34D399] font-bold bg-[#34D399]/10 px-4 py-1 rounded-full border border-[#34D399]/20 text-sm">
                        <CheckCircle className="w-4 h-4 mr-1.5" /> Solved
                    </span>
                ) : (
                    <div className="flex gap-1.5">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`w-2.5 h-2.5 rounded-full ${i <= hintsUsed ? 'bg-amber-400' : 'bg-[#0A192F]/10'}`} />
                        ))}
                    </div>
                )}
            </div>

            <h3 className="text-xl font-semibold text-[#0A192F] mb-6 leading-relaxed">
                {question.question_text}
            </h3>

            {/* Hints Section */}
            <div className="space-y-3 mb-6">
                <AnimatePresence>
                    {hints.map((hint, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-amber-50 rounded-[16px] p-5 border-l-4 border-amber-400"
                        >
                            <h4 className="flex items-center text-amber-600 font-bold mb-2 text-sm">
                                <Sparkles className="w-4 h-4 mr-2" />
                                {idx === 0 ? "Conceptual Hint" : idx === 1 ? "Approach Hint" : "Reasoning Hint"}
                            </h4>
                            <p className="text-[#0A192F] font-medium text-sm leading-relaxed">{hint}</p>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Controls */}
            {!isSolved && (
                <div className="flex flex-wrap gap-3">
                    {hintsUsed < 3 ? (
                        <button
                            onClick={handleUnlockHint}
                            disabled={loadingHint}
                            className="neo-button flex items-center gap-2 px-5 py-2.5 text-sm"
                        >
                            {loadingHint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                            {loadingHint ? 'Thinking...' : `Get Hint (${hintsUsed + 1}/3)`}
                        </button>
                    ) : (
                        <span className="text-[#64748B] italic flex items-center text-sm font-medium">
                            <Lock className="w-4 h-4 mr-2" /> No more hints. You got this!
                        </span>
                    )}

                    <button className="px-5 py-2.5 rounded-[12px] border-2 border-[#0A192F]/10 hover:border-[#0A192F]/20 text-[#64748B] font-medium text-sm transition-colors ml-auto">
                        Submit Answer
                    </button>
                </div>
            )}
        </motion.div>
    );
}

export default GuidedPaperSolver;
