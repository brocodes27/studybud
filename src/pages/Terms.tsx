import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-[#64748B] hover:text-[#0A192F] transition-colors text-sm font-medium mb-10">
          <ArrowLeft className="w-4 h-4" />Back to Home
        </Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[#00D1FF]/10 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#00D1FF]" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#0A192F] tracking-tight">Terms of Service</h1>
        </div>
        <p className="text-[#64748B] text-sm mb-8">Last updated: April 26, 2026</p>
        <div className="space-y-8 text-[#0A192F]/80 leading-relaxed text-sm">
          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-2">1. Acceptance</h2>
            <p>By using elevenfolks, you agree to these terms. If you disagree, do not use the service.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-2">2. Service Description</h2>
            <p>We provide AI-powered study tools. We do not guarantee specific academic outcomes. AI content is for educational purposes only.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-2">3. Accounts</h2>
            <p>You must be 13+ (with parental consent if under 18). Keep credentials secure. We may suspend accounts for violations.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-2">4. Subscriptions</h2>
            <p>Premium requires paid subscription via Dodo/PayPal/Razorpay. Auto-renews unless cancelled. Refunds within 7 days.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-2">5. Acceptable Use</h2>
            <p>No unlawful use, unauthorized access, scraping, or harmful content. Respect intellectual property.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-2">6. AI Disclaimer</h2>
            <p>AI-generated content may contain errors. Always verify with official sources. We are not liable for decisions based solely on AI output.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-2">7. Liability</h2>
            <p>We are not liable for direct, indirect, or consequential damages from service use.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-2">8. Termination</h2>
            <p>We may terminate accounts for violations. You may delete your account anytime. Data retained 30 days then permanently deleted.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-2">9. Contact</h2>
            <p>Questions? Contact <a href="mailto:legal@elevenfolks.com" className="text-[#00D1FF] hover:underline">legal@elevenfolks.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
