import { Zap, Crown, Check, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePayment } from '../hooks/usePayment';

export function SubscriptionPage() {
    const { isPremium } = useAuth();
    const { initiatePayment, isLoadingPayment } = usePayment();

    const features = [
        { name: "AI Study Plans", free: "1 / month", pro: "Unlimited + Detailed" },
        { name: "Flashcards", free: "20 / deck", pro: "Unlimited + From PDF" },
        { name: "Practice Tests", free: "1 / week (text)", pro: "Visual + AI Explanations" },
        { name: "Lectures", free: "Audio Summaries", pro: "HD Neural Video Lectures" },
        { name: "Voices", free: "Standard", pro: "Ultra-Realistic Neural" },
        { name: "Social Groups", free: "Join Only", pro: "Create & Manage Private Groups" },
        { name: "Analytics", free: "Basic Stats", pro: "Deep Learning Insights" },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans relative overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
            {/* Background Ambience */}
            <div className="absolute top-20 left-20 w-32 h-32 bg-neo-secondary border border-white/10 rounded-full shadow-neo -z-10 animate-pulse" />
            <div className="absolute bottom-40 right-40 w-48 h-48 bg-neo-accent border border-white/10 rotate-12 shadow-neo -z-10 animate-bounce" />

            <div className="max-w-6xl mx-auto relative z-10">
                <header className="text-center mb-20 space-y-6">
                    <div className="inline-flex items-center gap-4 px-6 py-2 border border-white/10 bg-slate-800 shadow-neo -rotate-1">
                        <Crown className="w-6 h-6 text-yellow-500 stroke-[3px]" />
                        <span className="text-sm font-black tracking-[0.2em] uppercase italic">LEVEL_UP_YOUR_NEURAL_PROCESSING</span>
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-none">
                        UPGRADE_TO_<span className="text-neo-accent underline decoration-8 decoration-black">PRO</span>
                    </h1>
                    <p className="text-xl font-bold uppercase tracking-widest text-slate-100/40 max-w-2xl mx-auto italic">
                        BYPASS_CORE_LIMITATIONS. ACCESS_ALL_NEURAL_MODULES_WITHOUT_RESTRICTION.
                    </p>
                </header>

                <div className="grid md:grid-cols-2 gap-10 mb-20">
                    {/* Free Plan */}
                    <div className="bg-slate-800 border border-white/10 p-10 relative shadow-neo -rotate-1 group hover:rotate-0 transition-all transform w-full">
                        <h3 className="text-3xl font-black uppercase italic mb-2 tracking-tighter flex items-center gap-4">
                            NEURO_FREE
                        </h3>

                        <div className="text-6xl font-black mb-2 text-slate-100 italic">
                            $0
                            <span className="text-lg text-slate-100/40 font-black uppercase tracking-widest not-italic ml-2">/MO</span>
                        </div>

                        <p className="font-black text-slate-100/40 uppercase text-xs tracking-widest mb-10 h-12 leading-tight italic border-b-2 border-white/10/10 pb-4">
                            FREE_CORE_ACCESS. BASIC_LIMITS_APPLY.
                        </p>

                        <ul className="space-y-6 mb-12">
                            {features.map((f, i) => (
                                <li key={i} className="flex items-center gap-4 text-xs font-black uppercase tracking-widest">
                                    <div className="w-6 h-6 border border-white/10 bg-slate-800 flex items-center justify-center flex-shrink-0 shadow-neo">
                                        <Check className="w-4 h-4 text-slate-100 stroke-[4px]" />
                                    </div>
                                    <span className="text-slate-100/60">{f.name}: </span>
                                    <span className="text-slate-100">{f.free}</span>
                                </li>
                            ))}
                        </ul>

                        <div className="bg-slate-900 border border-white/10 p-4 shadow-neo text-[10px] font-black uppercase tracking-widest text-slate-100/40">
                            FREE_LIMITS: 1_STUDY_PLAN/MO · 1_SUBJECT_ONLY · 20_FLASHCARDS/DECK · 1_PRACTICE_TEST/WEEK · PLAN_LENGTH_MAX_30_DAYS
                        </div>
                    </div>

                    {/* Pro Plan */}
                    <div className="bg-slate-800 border border-white/10 p-10 relative shadow-neo rotate-1 group hover:rotate-0 transition-all transform w-full">
                        <div className="absolute -top-6 -right-6 bg-neo-accent text-white px-6 py-3 border border-white/10 font-black text-xs uppercase tracking-[0.2em] -rotate-3 group-hover:rotate-0 transition-all shadow-neo">
                            SYSTEM_RECOMMENDED
                        </div>

                        <h3 className="text-3xl font-black uppercase italic mb-2 tracking-tighter flex items-center gap-4">
                            NEURO_PRO <Crown className="w-8 h-8 text-yellow-500 stroke-[3px]" />
                        </h3>

                        <div className="text-6xl font-black mb-2 text-slate-100 italic">
                            $15.99
                            <span className="text-lg text-slate-100/40 font-black uppercase tracking-widest not-italic ml-2">/MO</span>
                        </div>

                        <p className="font-black text-neo-accent uppercase text-xs tracking-widest mb-10 h-12 leading-tight italic border-b-2 border-neo-accent/20 pb-4">
                            FULL_PROTOCOL_ACCESS. FREEMIUM_BASE_INCLUDED. UPGRADE_ANYTIME.
                        </p>

                        <ul className="space-y-6 mb-12">
                            {features.map((f, i) => (
                                <li key={i} className="flex items-center gap-4 text-xs font-black uppercase tracking-widest">
                                    <div className="w-6 h-6 border border-white/10 bg-neo-secondary flex items-center justify-center flex-shrink-0 shadow-neo">
                                        <Check className="w-4 h-4 text-slate-100 stroke-[4px]" />
                                    </div>
                                    <span className="text-slate-100/60">{f.name}: </span>
                                    <span className="text-slate-100">{f.pro}</span>
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => initiatePayment()}
                            disabled={isLoadingPayment || isPremium}
                            className={`w-full py-6 border border-white/10 text-white font-black uppercase italic text-2xl shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo active:translate-x-0 active:translate-y-0 active:shadow-none transition-all flex items-center justify-center gap-4 ${isPremium ? 'bg-neo-accent' : 'bg-slate-900'}`}
                        >
                            {isLoadingPayment ? 'PROCESSING...' : isPremium ? 'LICENSE_VERIFIED' : 'UPGRADE_TO_PRO'}
                            {!isLoadingPayment && !isPremium && <Zap className="w-8 h-8 text-neon-yellow animate-bounce" />}
                            {isPremium && <Star className="w-8 h-8 text-yellow-500 fill-yellow-500 animate-pulse" />}
                        </button>
                        <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-100/30 mt-6 italic">FREE BASE TIER. UPGRADE OR CANCEL ANYTIME.</p>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="mt-40 max-w-4xl mx-auto space-y-12">
                    <h3 className="text-4xl font-black uppercase italic text-center tracking-tighter flex items-center justify-center gap-6">
                        <div className="w-12 h-1 border-t-8 border-white/10" />
                        CORE_QUERIES
                        <div className="w-12 h-1 border-t-8 border-white/10" />
                    </h3>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-slate-800 border border-white/10 p-8 shadow-neo -rotate-1">
                            <h4 className="font-black text-lg mb-4 uppercase italic border-b-2 border-white/10/10 pb-2">FREEMIUM_MODEL?</h4>
                            <p className="font-bold text-sm text-slate-100/50 uppercase tracking-tight leading-tight">FREE CORE ACCESS FOREVER. UPGRADE TO PRO FOR UNLIMITED MODULES.</p>
                        </div>
                        <div className="bg-slate-800 border border-white/10 p-8 shadow-neo rotate-1">
                            <h4 className="font-black text-lg mb-4 uppercase italic border-b-2 border-white/10/10 pb-2">REFUND_POLICY?</h4>
                            <p className="font-bold text-sm text-slate-100/50 uppercase tracking-tight leading-tight">ACCESS_REMAINS_ACTIVE_UNTIL_CYCLE_EXPIRATION. SUBSCRIPTIONS_CAN_BE_TERMINATED_ANYTIME.</p>
                        </div>
                        <div className="bg-slate-800 border border-white/10 p-8 shadow-neo rotate-1">
                            <h4 className="font-black text-lg mb-4 uppercase italic border-b-2 border-white/10/10 pb-2">DATA_PERSISTENCE?</h4>
                            <p className="font-bold text-sm text-slate-100/50 uppercase tracking-tight leading-tight">YOUR_NEURAL_HISTORY_IS_SAFE. DOWNGRADING_FREEZES_PRO_DATA_BUT_NEVER_DELETES.</p>
                        </div>
                        <div className="bg-slate-800 border border-white/10 p-8 shadow-neo -rotate-1">
                            <h4 className="font-black text-lg mb-4 uppercase italic border-b-2 border-white/10/10 pb-2">SUPPORT_TICKET?</h4>
                            <p className="font-bold text-sm text-slate-100/50 uppercase tracking-tight leading-tight">DIRECT_DEVELOPER_CHANNEL_OPEN_FOR_PRO_SUBSCRIBERS. 24H_RESOLUTION_TARGET.</p>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="mt-40 text-center pb-20">
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-100/20 italic">ANTIGRAVITY_STUDY_CORE_V3_LICENSED_2026</p>
            </footer>
        </div>
    );
}
