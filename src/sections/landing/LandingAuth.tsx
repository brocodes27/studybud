import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function LandingAuth() {
  const navigate = useNavigate();

  const handleClick = () => {
    window.location.href = '/auth';
  };

  return (
    <section id="auth" className="py-20 md:py-28 px-6">
      <div className="max-w-sm mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#2D2A26] mb-8" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Start your journey
        </h2>
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-[14px] font-bold text-white bg-[#2D2A26] hover:bg-[#3E3A35] transition-colors active:scale-[0.98] shadow-lg"
        >
          Sign Up / Sign In <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}

export default LandingAuth;