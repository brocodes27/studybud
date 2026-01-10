import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LandingHeader from '../sections/landing/LandingHeader';
import LandingHero from '../sections/landing/LandingHero';
import LandingBenefits from '../sections/landing/LandingBenefits';
import LandingFeatures from '../sections/landing/LandingFeatures';
import LandingCTA from '../sections/landing/LandingCTA';
import LandingAuth from '../sections/landing/LandingAuth';
import LandingTestimonials from '../sections/landing/LandingTestimonials';
import LandingFooter from '../sections/landing/LandingFooter';

const Landing: React.FC = () => {
  const { role, loading } = useAuth() as any;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neo-bg">
        <div className="w-16 h-16 border-8 border-black border-t-neo-accent animate-spin" />
      </div>
    );
  }

  if (role === 'teacher') {
    return <Navigate to="/teacher" replace />;
  }

  return (
    <div className="min-h-screen bg-neo-bg text-black selection:bg-neo-accent selection:text-black">
      <LandingHeader />
      <LandingHero />
      <LandingBenefits />
      <LandingFeatures />
      <LandingCTA />
      <LandingAuth />
      <LandingTestimonials />
      <LandingFooter />
    </div>
  );
};

export default Landing;
