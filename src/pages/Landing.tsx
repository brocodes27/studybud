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

// Light marketing landing (no heavy animations)

const Landing: React.FC = () => {
  const { role, loading } = useAuth() as any;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loading-spinner w-12 h-12"></div>
      </div>
    );
  }

  if (role === 'teacher') {
    return <Navigate to="/teacher" replace />;
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[radial-gradient(ellipse_200%_100%_at_bottom_left,#000_0%,#111_100%)] text-white">
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