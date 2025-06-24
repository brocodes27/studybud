import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudyPlanForm, FormData } from '../components/StudyPlanForm';
import { StudyPlanDisplay } from '../components/StudyPlanDisplay';
import { Brain, AlertCircle } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
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
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, session } = useAuth();

  const handleFormSubmit = async (data: FormData) => {
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
              onSave={handleSavePlan}
            />
          </div>
        )}
      </div>
    </div>
  );
}