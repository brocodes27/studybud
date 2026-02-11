import { useState } from 'react';
import { Zap, Crown, Check, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePayment } from '../hooks/usePayment';

export function SubscriptionPage() {
    const { isPremium } = useAuth();
    const { initiatePayment, isLoadingPayment } = usePayment();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

    const features = [
        { name: "AI Study Plans", free: "Basic (1/mo)", pro: "Unlimited + Detailed" },
        { name: "Flashcards", free: "20/deck", pro: "Unlimited + From PDF" },
        { name: "Practice Tests", free: "Text only", pro: "Visual + AI Explanations" },
        { name: "Lectures", free: "Audio Summaries", pro: "HD Neural Video Lectures" },
        { name: "Voices", free: "Standard Robotic", pro: "Ultra-Realistic Neural" },
        { name: "Social Groups", free: "Join Only", pro: "Create & Manage Private Groups" },
        { name: "Analytics", free: "Basic Stats", pro: "Deep Learning Insights" },
    ];

    return (
        <div className="min-h-screen bg-neo-bg text-black p-6 md:p-12 font-sans relative overflow-hidden bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]">
            {/* Background Ambience */}
            <div className="absolute top-20 left-20 w-32 h-32 bg-neo-secondary border-4 border-black rounded-full shadow-[8px_8px_0px_0px_#000] -z-10 animate-pulse" />
            <div className="absolute bottom-40 right-40 w-48 h-48 bg-neo-accent border-4 border-black rotate-12 shadow-[12px_12px_0px_0px_#000] -z-10 animate-bounce" />

            <div className="max-w-6xl mx-auto relative z-10">
                <header className="text-center mb-20 space-y-6">
                    <div className="inline-flex items-center gap-4 px-6 py-2 border-4 border-black bg-white shadow-[6px_6px_0px_0px_#000] -rotate-1">
                        <Crown className="w-6 h-6 text-yellow-500 stroke-[3px]" />
                        <span className="text-sm font-black tracking-[0.2em] uppercase italic">LEVEL_UP_YOUR_NEURAL_PROCESSING</span>
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-none">
                        UPGRADE_TO_<span className="text-neo-accent underline decoration-8 decoration-black">PRO</span>
                    </h1>
                    <p className="text-xl font-bold uppercase tracking-widest text-black/40 max-w-2xl mx-auto italic">
                        BYPASS_CORE_LIMITATIONS. ACCESS_ALL_NEURAL_MODULES_WITHOUT_RESTRICTION.
                    </p>
                </header>

                {/* Pricing Toggle */}
                <div className="flex justify-center mb-16">
                    <div className="bg-white p-2 border-4 border-black shadow-[8px_8px_0px_0px_#000] flex items-center gap-2 rotate-1">
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            className={`px-8 py-3 font-black text-sm tracking-widest transition-all ${billingCycle === 'monthly' ? 'bg-black text-white' : 'text-black hover:bg-neo-bg'}`}
                        >
                            MONTHLY_CYCLE
                        </button>
                        <button
                            onClick={() => setBillingCycle('yearly')}
                            className={`px-8 py-3 font-black text-sm tracking-widest transition-all flex items-center gap-3 ${billingCycle === 'yearly' ? 'bg-black text-white' : 'text-black hover:bg-neo-bg'}`}
                        >
                            YEARLY_CYCLE <span className="text-[10px] bg-neo-secondary text-black px-2 py-0.5 border-2 border-black rotate-3 font-black">SAVE_20%</span>
                        </button>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-12 items-start mb-20">
                    {/* Free Plan */}
                    <div className="bg-white border-8 border-black p-10 relative shadow-[16px_16px_0px_0px_#000] group hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[20px_20px_0px_0px_#000] transition-all">
                        <h3 className="text-3xl font-black uppercase italic mb-2 tracking-tighter">STARTER_NODE</h3>
                        <div className="text-5xl font-black mb-8 italic">$0<span className="text-lg text-black/40 font-black uppercase tracking-widest not-italic ml-2">/MO</span></div>

                        <p className="font-bold text-black/60 uppercase text-xs tracking-widest mb-10 h-12 leading-tight italic border-b-2 border-black/10 pb-4">
                            INITIAL_PHASE_ACCESS. BASIC_FUNCTIONALITY_FOR_SOLO_OPERATIVES.
                        </p>

                        <ul className="space-y-6 mb-12">
                            {features.map((f, i) => (
                                <li key={i} className="flex items-center gap-4 text-xs font-black uppercase tracking-widest">
                                    <div className="w-5 h-5 border-2 border-black bg-white flex items-center justify-center flex-shrink-0">
                                        <div className="w-2 h-2 bg-black/20" />
                                    </div>
                                    <span className="text-black/40">{f.name}: </span>
                                    <span className="text-black/60">{f.free}</span>
                                </li>
                            ))}
                        </ul>

                        <div className={`w-full py-5 border-4 border-black font-black uppercase italic text-xl text-center cursor-default ${!isPremium ? 'bg-neo-bg text-black' : 'bg-white text-black/20'}`}>
                            {!isPremium ? 'CURRENT_ACTIVE_SYNC' : 'DEPRIORITIZED_NODE'}
                        </div>
                    </div>

                    {/* Pro Plan */}
                    <div className="bg-white border-8 border-black p-10 relative shadow-[16px_16px_0px_0px_#4D96FF] rotate-1 group hover:rotate-0 transition-all transform md:-translate-y-6">
                        <div className="absolute -top-6 -right-6 bg-neo-accent text-white px-6 py-3 border-4 border-black font-black text-xs uppercase tracking-[0.2em] -rotate-3 group-hover:rotate-0 transition-all shadow-[6px_6px_0px_0px_#000]">
                            SYSTEM_RECOMMENDED
                        </div>

                        <h3 className="text-3xl font-black uppercase italic mb-2 tracking-tighter flex items-center gap-4">
                            NEURO_PRO <Crown className="w-8 h-8 text-yellow-500 stroke-[3px]" />
                        </h3>

                        <div className="text-6xl font-black mb-2 text-black italic">
                            ${billingCycle === 'monthly' ? '5' : '50'}
                            <span className="text-lg text-black/40 font-black uppercase tracking-widest not-italic ml-2">/{billingCycle === 'monthly' ? 'MO' : 'YR'}</span>
                        </div>

                        <p className="font-black text-neo-accent uppercase text-xs tracking-widest mb-10 h-12 leading-tight italic border-b-2 border-neo-accent/20 pb-4">
                            FULL_PROTOCOL_ACCESS. OPTIMIZED_FOR_MAXIMUM_KNOWLEDGE_RETENTION.
                        </p>

                        <ul className="space-y-6 mb-12">
                            {features.map((f, i) => (
                                <li key={i} className="flex items-center gap-4 text-xs font-black uppercase tracking-widest">
                                    <div className="w-6 h-6 border-2 border-black bg-neo-secondary flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0px_0px_#000]">
                                        <Check className="w-4 h-4 text-black stroke-[4px]" />
                                    </div>
                                    <span className="text-black/60">{f.name}: </span>
                                    <span className="text-black">{f.pro}</span>
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => initiatePayment()}
                            disabled={isLoadingPayment || isPremium}
                            className={`w-full py-6 border-4 border-black text-white font-black uppercase italic text-2xl shadow-[8px_8px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all flex items-center justify-center gap-4 ${isPremium ? 'bg-neo-accent' : 'bg-black'}`}
                        >
                            {isLoadingPayment ? 'PROCESSING_UPGRADE...' : isPremium ? 'LICENSE_VERIFIED' : 'UPGRADE_NOW'}
                            {!isLoadingPayment && !isPremium && <Zap className="w-8 h-8 text-neon-yellow animate-bounce" />}
                            {isPremium && <Star className="w-8 h-8 text-yellow-500 fill-yellow-500 animate-pulse" />}
                        </button>
                        <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-black/30 mt-6 italic">SECURE_DODO_GATEWAY_ENCRYPTED. ONE_CLICK_AUTH.</p>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="mt-40 max-w-4xl mx-auto space-y-12">
                    <h3 className="text-4xl font-black uppercase italic text-center tracking-tighter flex items-center justify-center gap-6">
                        <div className="w-12 h-1 border-t-8 border-black" />
                        CORE_QUERIES
                        <div className="w-12 h-1 border-t-8 border-black" />
                    </h3>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#000] -rotate-1">
                            <h4 className="font-black text-lg mb-4 uppercase italic border-b-2 border-black/10 pb-2">REFUND_PROTOCOL?</h4>
                            <p className="font-bold text-sm text-black/50 uppercase tracking-tight leading-tight">SYSTEM_SYNC_CAN_BE_TERMINATED_ANYTIME. ACCESS_REMAINS_ACTIVE_UNTIL_CYCLE_EXPIRATION.</p>
                        </div>
                        <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#000] rotate-1">
                            <h4 className="font-black text-lg mb-4 uppercase italic border-b-2 border-black/10 pb-2">UNLIMITED_MODES?</h4>
                            <p className="font-bold text-sm text-black/50 uppercase tracking-tight leading-tight">NODE_GENERATION_IS_ABSOLUTE. FAIR_USE_ENFORCED_ONLY_VS_BOT_INTRUSION.</p>
                        </div>
                        <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#000] rotate-1">
                            <h4 className="font-black text-lg mb-4 uppercase italic border-b-2 border-black/10 pb-2">DATA_PERSISTENCE?</h4>
                            <p className="font-bold text-sm text-black/50 uppercase tracking-tight leading-tight">YOUR_NEURAL_HISTORY_IS_SAFE. DOWNGRADING_FREEZES_PRO_DATA_BUT_NEVER_DELETES.</p>
                        </div>
                        <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#000] -rotate-1">
                            <h4 className="font-black text-lg mb-4 uppercase italic border-b-2 border-black/10 pb-2">SUPPORT_TICKET?</h4>
                            <p className="font-bold text-sm text-black/50 uppercase tracking-tight leading-tight">DIRECT_DEVELOPER_CHANNEL_OPEN_FOR_PRO_SUBSCRIBERS. 24H_RESOLUTION_TARGET.</p>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="mt-40 text-center pb-20">
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-black/20 italic">ANTIGRAVITY_STUDY_CORE_V3_LICENSED_2026</p>
            </footer>
        </div>
    );
}
