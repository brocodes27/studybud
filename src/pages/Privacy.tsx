import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-[#64748B] hover:text-[#0A192F] transition-colors text-sm font-medium mb-10">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[#00D1FF]/10 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#00D1FF]" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#0A192F] tracking-tight">Privacy Policy</h1>
        </div>

        <p className="text-[#64748B] text-sm mb-8">Last updated: April 26, 2026</p>

        <div className="space-y-8 text-[#0A192F]/80 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-3">1. Information We Collect</h2>
            <p className="text-sm">
              We collect information you provide directly, including your name, email address, educational institution,
              and study preferences. We also collect usage data such as study sessions completed, task completions,
              and AI interaction history to personalize your learning experience.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-3">2. How We Use Your Information</h2>
            <p className="text-sm">
              We use your data to generate personalized study plans, provide AI tutoring, track learning progress,
              and improve our services. We process this data using secure AI models and do not sell your personal
              information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-3">3. Data Storage & Security</h2>
            <p className="text-sm">
              Your data is stored securely using Supabase infrastructure with row-level security (RLS) policies.
              All data transmission is encrypted via TLS. Payment information is handled by our PCI-compliant
              payment processors (Dodo Payments, PayPal, Razorpay) and is never stored on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-3">4. AI Data Processing</h2>
            <p className="text-sm">
              When you interact with our AI features, your inputs may be sent to third-party AI providers
              (Google Gemini, OpenAI) for processing. We do not use your data to train these models.
              Audio and video data from voice/avatar features are processed only during active sessions
              and are not retained.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-3">5. Your Rights</h2>
            <p className="text-sm">
              You have the right to access, correct, or delete your personal data. You can export your data
              from your Profile settings or request deletion by contacting us at privacy@elevenfolks.com.
              We comply with GDPR, CCPA, and India's DPDP Act requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-3">6. Cookies & Analytics</h2>
            <p className="text-sm">
              We use cookies for authentication and analytics. We use Dub.co for link analytics and
              may use anonymized usage data to improve our product. You can disable cookies in your
              browser settings, though this may limit functionality.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#0A192F] mb-3">7. Contact</h2>
            <p className="text-sm">
              For privacy-related questions or data deletion requests, contact us at{' '}
              <a href="mailto:privacy@elevenfolks.com" className="text-[#00D1FF] hover:underline">privacy@elevenfolks.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
