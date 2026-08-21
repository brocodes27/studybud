import { Crown, Check, DollarSign } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { usePayment } from '../hooks/usePayment';

export default function SubscriptionPage() {
    const { isLoadingPayment, initiatePayment } = usePayment();
    const { track } = useAnalytics();
    const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'semester'>('semester');

    useEffect(() => {
        track('subscription_page_view');
    }, [track]);

    const features = [
        { name: "Daily Grade Forecast", free: "1 course preview", pro: "All enrolled courses" },
        { name: "Grade Engine", free: "Current standing only", pro: "Layer 2 predictive forecast range" },
        { name: "High-Leverage Daily Action", free: "Basic mission", pro: "Ranked by grade impact / min" },
        { name: "Atlas Tutor & Socratic Practice", free: "Limited", pro: "Unlimited deep-linked tutoring" },
        { name: "Problem Set Scanner", free: "3 scans / month", pro: "Unlimited STEM notebook scanning" },
        { name: "Shareable Forecast Cards", free: "Watermarked", pro: "Full custom card export" },
    ];

    return (
        <div className="curve-root min-h-screen bg-[#0a0814] text-white pb-20 animate-fade-in p-4 sm:p-8">
            {/* Soft ambient bg orbs */}
            <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-[#8b5cf6]/15 rounded-full blur-[120px] pointer-events-none -z-10" />
            <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-[#f472b6]/10 rounded-full blur-[100px] pointer-events-none -z-10" />

            <div className="max-w-5xl mx-auto px-4">
                {/* Header */}
                <div className="text-center mb-12 space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#8b5cf6]/15 text-[#c4b5fd] rounded-full font-bold text-sm border border-[#8b5cf6]/30">
                        <Crown className="w-4 h-4 text-[#fbbf24]" />
                        <span>Curve Pro Student Access</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight text-white">
                        Know your grade before <span className="bg-gradient-to-r from-[#a78bfa] to-[#f472b6] bg-clip-text text-transparent">your professor does</span>
                    </h1>
                    <p className="text-lg font-medium text-curve-muted max-w-2xl mx-auto leading-relaxed">
                        One daily updated forecast per course and the single highest-leverage action to move it.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-2 gap-8 mb-16">
                    {/* Monthly Plan */}
                    <div
                      onClick={() => setSelectedPlan('monthly')}
                      className={`p-6 rounded-3xl bg-[#130f24] border cursor-pointer transition-all ${selectedPlan === 'monthly' ? 'border-[#8b5cf6] ring-2 ring-[#8b5cf6]/40' : 'border-white/10'}`}
                    >
                        <h3 className="text-2xl font-extrabold tracking-tight mb-1 text-white">Monthly Pass</h3>
                        <div className="flex items-end gap-1 mb-2">
                            <DollarSign className="w-8 h-8 text-[#a78bfa] mb-2" />
                            <span className="text-5xl font-extrabold text-white">12.99</span>
                            <span className="text-curve-muted font-medium mb-2">/month</span>
                        </div>
                        <p className="text-curve-muted font-medium text-sm mb-8 pb-6 border-b border-white/10">
                            Flexible month-to-month subscription. Cancel anytime.
                        </p>

                        <ul className="space-y-4 mb-8">
                            {features.map((f, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-[#8b5cf6]/20 flex items-center justify-center shrink-0 mt-0.5">
                                        <Check className="w-3 h-3 text-[#c4b5fd] stroke-[3px]" />
                                    </div>
                                    <span className="text-sm font-medium text-curve-muted">
                                        <span className="text-white font-bold">{f.name}:</span> {f.pro}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <button
                          onClick={() => { setSelectedPlan('monthly'); initiatePayment('monthly'); }}
                          disabled={isLoadingPayment}
                          className={`w-full py-4 rounded-2xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 ${selectedPlan === 'monthly'
                            ? 'bg-[#8b5cf6] hover:bg-[#7c3aed] text-white shadow-lg'
                            : 'bg-white/5 hover:bg-white/10 text-curve-muted border border-white/10'}`}
                        >
                            {isLoadingPayment ? 'Processing...' : 'Choose Monthly — $12.99'}
                        </button>
                    </div>

                    {/* Semester Pass */}
                    <div
                      onClick={() => setSelectedPlan('semester')}
                      className={`p-6 rounded-3xl relative border-2 cursor-pointer transition-all bg-gradient-to-b from-[#191233] to-[#0e091f] ${selectedPlan === 'semester' ? 'border-[#8b5cf6] ring-4 ring-[#8b5cf6]/30 shadow-2xl' : 'border-white/20'}`}
                    >
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-[#8b5cf6] text-white rounded-full font-extrabold text-xs shadow-lg">
                            Best Value · Save 30%
                        </div>

                        <h3 className="text-2xl font-extrabold text-white tracking-tight mb-1 flex items-center gap-2">
                            Semester Pass <Crown className="w-5 h-5 text-[#fbbf24]" />
                        </h3>
                        <div className="flex items-end gap-1 mb-2">
                            <DollarSign className="w-8 h-8 text-[#a78bfa] mb-2" />
                            <span className="text-5xl font-extrabold text-white">39.00</span>
                            <span className="text-curve-muted font-medium mb-2">/4-month semester</span>
                        </div>
                        <p className="text-[#a78bfa] font-bold text-sm mb-8 pb-6 border-b border-white/10">
                            Covers your full academic semester across all courses.
                        </p>

                        <ul className="space-y-4 mb-8">
                            {features.map((f, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-[#8b5cf6]/30 flex items-center justify-center shrink-0 mt-0.5">
                                        <Check className="w-3 h-3 text-[#34d399] stroke-[3px]" />
                                    </div>
                                    <span className="text-sm font-medium text-white/90">
                                        <span className="text-white font-bold">{f.name}:</span> {f.pro}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <button
                          onClick={() => { setSelectedPlan('semester'); initiatePayment('semester'); }}
                          disabled={isLoadingPayment}
                          className="w-full py-4 rounded-2xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-extrabold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            {isLoadingPayment ? 'Processing...' : 'Unlock Semester Pass — $39'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
