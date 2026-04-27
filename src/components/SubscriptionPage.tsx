import { Zap, Crown, Check, Star, Sparkles, IndianRupee } from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { usePayment } from '../hooks/usePayment';

export default function SubscriptionPage() {
    const { isPremium, role, isAdmin } = useAuth() as any;
    const { isLoadingPayment, initiatePayment } = usePayment();
    const { track } = useAnalytics();

    useEffect(() => {
        track('subscription_page_view');
    }, [track]);

    const features = [
        { name: "JEE Prove-It", free: "1 attempt / day", pro: "Unlimited credentials" },
        { name: "Mastery Tree", free: "Basic progress", pro: "Full branch tracking" },
        { name: "Score Prediction", free: "Preview", pro: "JEE target-gap plan" },
        { name: "Squad Accountability", free: "Join squads", pro: "Create squads" },
        { name: "Daily Prescriptions", free: "Limited", pro: "Adaptive JEE plan" },
        { name: "Teacher Assignments", free: "Assigned only", pro: "Full analytics" },
        { name: "Mastery Reports", free: "Weekly summary", pro: "Shareable report cards" },
    ];

    const faqs = [
        { q: "Who needs a subscription?", a: "Students need Pro to access the app. Teachers can access their teaching workspace for free." },
        { q: "Refund policy?", a: "Access remains active until cycle expiration. Cancel anytime." },
        { q: "Data persistence?", a: "Your history is safe. Downgrading freezes Pro data but never deletes it." },
        { q: "Support?", a: "Direct developer channel open for Pro subscribers. 24h resolution target." },
    ];

    return (
        <div className="pb-20 animate-fade-in">
            {/* Soft bg orbs */}
            <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-[#00D1FF]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
            <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-[#F472B6]/5 rounded-full blur-[100px] pointer-events-none -z-10" />

            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16 space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F472B6]/10 text-[#F472B6] rounded-full font-bold text-sm border border-[#F472B6]/20">
                        <Crown className="w-4 h-4" />
                        <span>Student access pass</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-[#0A192F] leading-tight">
                        Student Pro <span className="text-[#00D1FF]">Access</span>
                    </h1>
                    <p className="text-xl font-medium text-[#64748B] max-w-2xl mx-auto leading-relaxed">
                        Students need an active subscription to enter the app. Teachers get free access to their workspace.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-2 gap-8 mb-16">
                    {/* Free Plan */}
                    <div className="neo-card">
                        <h3 className="text-2xl font-extrabold text-[#0A192F] tracking-tight mb-1">Teacher</h3>
                        <div className="flex items-end gap-1 mb-2">
                            <span className="text-5xl font-extrabold text-[#0A192F]">₹0</span>
                            <span className="text-[#64748B] font-medium mb-2">for teachers</span>
                        </div>
                        <p className="text-[#64748B] font-medium text-sm mb-8 pb-6 border-b border-[#0A192F]/5">
                            Teachers can access the app for free.
                        </p>

                        <ul className="space-y-4 mb-8">
                            {features.map((f, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-[#0A192F]/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <Check className="w-3 h-3 text-[#0A192F] stroke-[3px]" />
                                    </div>
                                    <span className="text-sm font-medium text-[#64748B]">
                                        <span className="text-[#0A192F] font-bold">{f.name}:</span> {f.free}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <div className="bg-slate-50 rounded-[16px] p-4 border border-[#0A192F]/5">
                            <p className="text-xs font-bold text-[#64748B] leading-relaxed">
                                Free teacher access · class management · assignments · learner insights
                            </p>
                        </div>
                    </div>

                    {/* Pro Plan */}
                    <div className="neo-card relative border-2 border-[#00D1FF]/30 shadow-float-cyan">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-[#00D1FF] text-[#0A192F] rounded-full font-extrabold text-xs shadow-float-cyan">
                            Recommended
                        </div>

                        <h3 className="text-2xl font-extrabold text-[#0A192F] tracking-tight mb-1 flex items-center gap-2">
                            Pro <Crown className="w-5 h-5 text-[#F472B6]" />
                        </h3>
                        <div className="flex items-end gap-1 mb-2">
                            <IndianRupee className="w-8 h-8 text-[#0A192F] mb-2" />
                            <span className="text-5xl font-extrabold text-[#0A192F]">199</span>
                            <span className="text-[#64748B] font-medium mb-2">/month</span>
                        </div>
                        <p className="text-[#00D1FF] font-bold text-sm mb-8 pb-6 border-b border-[#00D1FF]/20">
                            Required for student access.
                        </p>

                        <ul className="space-y-4 mb-8">
                            {features.map((f, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-[#00D1FF]/20 flex items-center justify-center shrink-0 mt-0.5">
                                        <Check className="w-3 h-3 text-[#00D1FF] stroke-[3px]" />
                                    </div>
                                    <span className="text-sm font-medium text-[#64748B]">
                                        <span className="text-[#0A192F] font-bold">{f.name}:</span> {f.pro}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => { track('payment_initiate', { plan: 'pro' }); initiatePayment(); }}
                            disabled={isLoadingPayment || isPremium || role === 'teacher' || isAdmin}
                            className="neo-button w-full py-4 text-base shadow-float-cyan"
                        >
                            {isLoadingPayment ? 'Processing...' : role === 'teacher' || isAdmin ? 'Free Access Enabled' : isPremium ? 'You\'re Pro' : 'Subscribe to Access'}
                            {!isLoadingPayment && !isPremium && role !== 'teacher' && !isAdmin && <Zap className="w-5 h-5 stroke-[2.5px]" />}
                            {(isPremium || role === 'teacher' || isAdmin) && <Star className="w-5 h-5 fill-current" />}
                        </button>
                        <p className="text-center text-xs font-medium text-[#64748B] mt-4">Coaching centers: bulk pricing available. Contact us.</p>
                    </div>
                </div>

                {/* FAQ */}
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D1FF]/10 text-[#00D1FF] rounded-full font-bold text-sm border border-[#00D1FF]/20 mb-4">
                            <Sparkles className="w-4 h-4" />
                            <span>Common Questions</span>
                        </div>
                        <h2 className="text-3xl font-extrabold text-[#0A192F] tracking-tight">Got questions?</h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-5">
                        {faqs.map((faq, i) => (
                            <div key={i} className="bg-white rounded-[24px] p-6 border-2 border-[#0A192F]/5 hover:border-[#00D1FF]/20 hover:shadow-float-cyan transition-all">
                                <h4 className="font-extrabold text-[#0A192F] mb-2 tracking-tight">{faq.q}</h4>
                                <p className="font-medium text-sm text-[#64748B] leading-relaxed">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
