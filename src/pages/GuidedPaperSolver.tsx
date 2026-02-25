
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
            <div className="min-h-screen text-white p-6 md:p-12 max-w-7xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500 mb-4">
                        Guided Paper Solver
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl">
                        Upload your exam papers. Our AI extracts questions and helps you solve them with progressive hints. No direct answers—just pure learning.
                    </p>
                </header>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="w-12 h-12 text-teal-400 animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Upload Card */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="group cursor-pointer border border-dashed border-gray-700 bg-gray-900/50 rounded-3xl h-64 flex flex-col items-center justify-center p-6 hover:border-teal-500/50 hover:bg-teal-900/10 transition-all duration-300 relative overflow-hidden"
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*,application/pdf"
                                onChange={handleFileUpload}
                            />
                            {uploading ? (
                                <div className="flex flex-col items-center z-10">
                                    <Loader2 className="w-12 h-12 text-teal-400 animate-spin mb-4" />
                                    <span className="text-teal-400 font-medium">Extracting Questions...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-teal-500/20 group-hover:scale-110 transition-all">
                                        <Upload className="w-8 h-8 text-gray-400 group-hover:text-teal-400" />
                                    </div>
                                    <div className="text-center z-10">
                                        <h3 className="text-xl font-bold text-gray-200 group-hover:text-white">Upload Paper</h3>
                                        <p className="text-sm text-gray-500 mt-2">PDF or Image</p>
                                    </div>
                                </>
                            )}

                            {/* Background Glow */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {/* Paper List */}
                        {papers.map((paper) => (
                            <motion.div
                                key={paper.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => paper.status === 'ready' && setSelectedPaper(paper)}
                                className={`relative bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-3xl p-6 flex flex-col justify-between h-64 group transition-all duration-300 ${paper.status === 'ready' ? 'hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer' : 'opacity-70'}`}
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${paper.status === 'ready' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        {paper.status === 'processing' && (
                                            <span className="text-xs font-mono px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 flex items-center gap-1">
                                                <Loader2 className="w-3 h-3 animate-spin" /> Processing
                                            </span>
                                        )}
                                        {paper.status === 'ready' && (
                                            <span className="text-xs font-mono px-2 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                                                Ready
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">{paper.title}</h3>
                                    <p className="text-sm text-gray-500">{new Date(paper.created_at).toLocaleDateString()}</p>
                                </div>

                                <div className="flex items-center text-sm text-gray-400 group-hover:text-blue-400 transition-colors">
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
        <div className="min-h-screen bg-slate-900/90 text-white flex flex-col md:flex-row">
            {/* Sidebar / Back */}
            <div className="w-full md:w-80 border-r border-gray-800 p-6 flex flex-col bg-gray-900/50 backdrop-blur-xl h-screen sticky top-0">
                <button
                    onClick={() => setSelectedPaper(null)}
                    className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 mr-1" /> Back to Papers
                </button>

                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">{selectedPaper.title}</h2>
                    <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-teal-400 to-blue-500"
                            style={{ width: `${(Object.values(attempts).filter(a => a.is_solved).length / questions.length) * 100}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 flex justify-between">
                        <span>Progress</span>
                        <span>{Object.values(attempts).filter(a => a.is_solved).length} / {questions.length} Solved</span>
                    </p>
                </div>

                {/* Question Nav */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {questions.map((q) => {
                        const isSolved = attempts[q.id]?.is_solved;
                        const isWIP = attempts[q.id]?.current_hint_level > 0 && !isSolved;

                        return (
                            <a
                                key={q.id}
                                href={`#q-${q.id}`}
                                className={`block p-3 rounded-xl border transition-all ${isSolved ? 'bg-green-500/10 border-green-500/30 text-green-400' : isWIP ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-mono text-sm">Question {q.question_number}</span>
                                    {isSolved && <CheckCircle className="w-4 h-4" />}
                                    {isWIP && <Clock className="w-4 h-4" />}
                                </div>
                            </a>
                        )
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 md:p-12 overflow-y-auto max-h-screen custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-12 pb-24">
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
            className="bg-gray-900 border border-gray-800 rounded-3xl p-8 relative overflow-hidden"
        >
            <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-gray-700 to-transparent" />

            <div className="mb-6 flex justify-between items-start">
                <span className="font-mono text-teal-500 font-bold text-lg bg-teal-500/10 px-4 py-1 rounded-full border border-teal-500/20">
                    Q{question.question_number}
                </span>
                {isSolved ? (
                    <span className="flex items-center text-green-400 font-bold bg-green-500/10 px-4 py-1 rounded-full border border-green-500/20">
                        <CheckCircle className="w-5 h-5 mr-2" /> Solved
                    </span>
                ) : (
                    <div className="flex gap-1">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`w-3 h-3 rounded-full ${i <= hintsUsed ? 'bg-amber-400 shadow-lg shadow-amber-400/50' : 'bg-gray-700'}`} />
                        ))}
                    </div>
                )}
            </div>

            <h3 className="text-2xl font-medium text-white mb-8 leading-relaxed">
                {question.question_text}
            </h3>

            {/* Hints Section */}
            <div className="space-y-4 mb-8">
                <AnimatePresence>
                    {hints.map((hint, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-gray-800/50 rounded-2xl p-6 border-l-4 border-amber-500"
                        >
                            <h4 className="flex items-center text-amber-500 font-bold mb-2">
                                <Sparkles className="w-4 h-4 mr-2" />
                                {idx === 0 ? "Conceptual Hint" : idx === 1 ? "Approach Hint" : "Reasoning Hint"}
                            </h4>
                            <p className="text-gray-300">{hint}</p>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Controls */}
            {!isSolved && (
                <div className="flex flex-wrap gap-4">
                    {hintsUsed < 3 ? (
                        <button
                            onClick={handleUnlockHint}
                            disabled={loadingHint}
                            className="btn-primary flex items-center gap-2"
                        >
                            {loadingHint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                            {loadingHint ? 'Thinking...' : `Get Hint (${hintsUsed + 1}/3)`}
                        </button>
                    ) : (
                        <span className="text-gray-500 italic flex items-center">
                            <Lock className="w-4 h-4 mr-2" /> No more hints available. You got this!
                        </span>
                    )}

                    {/* Placeholder for "Submit" or "Mark Solved" */}
                    <button className="px-6 py-3 rounded-xl border border-gray-700 hover:bg-gray-800 text-gray-300 font-medium transition-colors ml-auto">
                        Submit Answer
                    </button>
                </div>
            )}
        </motion.div>
    );
}

export default GuidedPaperSolver;
