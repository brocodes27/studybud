import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudyPlanForm, FormData } from '../components/StudyPlanForm';
import { StudyPlanDisplay } from '../components/StudyPlanDisplay';
import { PremiumGate } from '../components/PremiumGate';
import { Brain, AlertCircle } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { supabase } from '../lib/supabase';

interface StudyPlan {
  days_until_exam: number;
  daily_schedule: Array<{
    day: number;
    date: string;
    topic: string;
    question_type: string;
    description: string;
    practice_questions?: string[];
  }>;
}

export function CreatePlan() {
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planCount, setPlanCount] = useState(0);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, session } = useAuth();
  const { isPremiumUser } = useSubscription();

  // Check plan count for free users
  React.useEffect(() => {
    if (user && !isPremiumUser()) {
      checkPlanCount();
    }
  }, [user, isPremiumUser]);

  const checkPlanCount = async () => {
    try {
      const { count, error } = await supabase
        .from('exam_plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      if (error) throw error;
      setPlanCount(count || 0);
    } catch (error) {
      console.error('Error checking plan count:', error);
    }
  };

  const handleFormSubmit = async (data: FormData) => {
    // Check if free user has exceeded limit
    if (!isPremiumUser() && planCount >= 3) {
      showToast('Free plan limit reached. Upgrade to Premium for unlimited study plans!', 'error');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate study plan');
      }

      const plan = await response.json();
      setStudyPlan(plan);
      setFormData(data);
      showToast('Study plan generated successfully!', 'success');
      
      // Update plan count for free users
      if (!isPremiumUser()) {
        setPlanCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error generating study plan:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setStudyPlan(null);
    setFormData(null);
    setError(null);
  };

  const handleSavePlan = async () => {
    if (!studyPlan || !formData || !user) return;

    try {
      // The plan is already saved by the edge function, so we just need to navigate
      showToast('Study plan saved to your dashboard!', 'success');
      navigate('/plans');
    } catch (error) {
      console.error('Error saving plan:', error);
      showToast('Failed to save study plan', 'error');
    }
  };

  // Show premium gate for free users who have reached their limit
  if (!isPremiumUser() && planCount >= 3 && !studyPlan) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 rounded-2xl shadow-lg">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Create Study Plan
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Generate a personalized AI-powered study schedule with practice questions
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <PremiumGate
            feature="Unlimited Study Plans"
            description="You've reached the free plan limit of 3 study plans per month. Upgrade to Premium for unlimited AI-powered study plans, advanced analytics, and more!"
            onUpgrade={() => navigate('/subscription')}
          >
            <div />
          </PremiumGate>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 rounded-2xl shadow-lg">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Create Study Plan
          </h1>
        </div>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Generate a personalized AI-powered study schedule with practice questions
        </p>
        
        {/* Plan count indicator for free users */}
        {!isPremiumUser() && (
          <div className="mt-4 inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm">
            <Brain className="h-4 w-4" />
            Free Plan: {planCount}/3 study plans this month
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-800">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {!studyPlan ? (
          <StudyPlanForm onSubmit={handleFormSubmit} loading={loading} />
        ) : (
          <div className="space-y-6">
            <StudyPlanDisplay 
              plan={studyPlan} 
              formData={formData!} 
              onReset={handleCreateNew}
            />
            
            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleSavePlan}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
              >
                Go to Dashboard
              </button>
              <button
                onClick={handleCreateNew}
                className="bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-8 rounded-xl border border-gray-200 transition-colors duration-200"
              >
                Create Another Plan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}