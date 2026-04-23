import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LandingHeader from '../sections/landing/LandingHeader';
import LandingHero from '../sections/landing/LandingHero';
import LandingBenefits from '../sections/landing/LandingBenefits';
import LandingFeatures from '../sections/landing/LandingFeatures';
import LandingCurriculum from '../sections/landing/LandingCurriculum';
import LandingCTA from '../sections/landing/LandingCTA';
import LandingAuth from '../sections/landing/LandingAuth';
import LandingTestimonials from '../sections/landing/LandingTestimonials';
import LandingFooter from '../sections/landing/LandingFooter';

const Landing: React.FC = () => {
  const { role, loading } = useAuth() as any;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="w-8 h-8 border-2 border-[#2D2A26]/10 border-t-[#8B7355] rounded-full animate-spin" />
      </div>
    );
  }

  if (role === 'teacher') {
    return <Navigate to="/teacher" replace />;
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <LandingHeader />
      <LandingHero />
      <LandingBenefits />
      <LandingFeatures />
      <LandingCurriculum />
      <LandingCTA />
      <LandingAuth />
      <LandingTestimonials />
      <LandingFooter />
    </div>
  );
};

export default Landing;
