import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

import { StudyPlanForm, FormData } from '../components/StudyPlanForm';
import { StudyPlanDisplay } from '../components/StudyPlanDisplay';
import { Brain, AlertCircle } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

interface StudyPlan {
  days_until_exam: number;
  daily_schedule: Array<{
    day: number;
    date: string;
    chapter?: string;
    topic: string;
    question_type: string;
    description: string;
    practice_questions?: string[];
  }>;
}

export function CreatePlan() {
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [searchParams] = useSearchParams();
  const initialDataFromParams: Partial<FormData> = {
    plan_name: searchParams.get('plan_name') || undefined,
    subject: searchParams.get('subject') || undefined,
    exam_date: searchParams.get('exam_date') || undefined,
    chapters: searchParams.get('chapters') || undefined,
  };
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { session } = useAuth() as any;

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
        body: JSON.stringify({ ...data, plan_name: data.plan_name }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate study plan';
        try {
          const errorData = await response.json();
          // Include detailed error information if available
          if (errorData.details) {
            errorMessage = `${errorData.error || errorMessage}: ${errorData.details}`;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          // If response isn't JSON, use status text
          errorMessage = `${errorMessage} (Status: ${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const plan = await response.json();
      setStudyPlan(plan);
      setFormData(data);

      // Persist the custom plan name if it exists and wasn't stored by the edge function
      if (data.plan_name) {
        let updateErr = null;
        if (plan && (plan as any).id) {
          const { error: nameErr } = await supabase
            .from('exam_plans')
            .update({ plan_name: data.plan_name })
            .eq('id', (plan as any).id);
          updateErr = nameErr;
        } else {
          // Fallback: find the most recently created matching plan for this user/subject/date
          const { data: latestPlan, error: fetchErr } = await supabase
            .from('exam_plans')
            .select('id')
            .eq('user_id', session?.user?.id)
            .eq('subject', data.subject)
            .eq('exam_date', data.exam_date)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!fetchErr && latestPlan) {
            const { error: upErr } = await supabase
              .from('exam_plans')
              .update({ plan_name: data.plan_name })
              .eq('id', latestPlan.id);
            updateErr = upErr;
          }
        }
        if (updateErr) {
          console.warn('Could not save plan_name:', updateErr.message);
        }
      }

    } catch (err) {
      console.error('Error generating study plan:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setStudyPlan(null);
    setFormData(null);
    setError(null);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-neon-blue to-neon-purple rounded-2xl flex items-center justify-center shadow-lg shadow-neon-blue/20">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Create <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">Study Plan</span>
          </h1>
        </div>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
          Generate a personalized AI-powered study schedule with practice questions tailored to your learning style and exam dates.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-4xl mx-auto">
          <div className="glass-card bg-red-500/10 border-red-500/20 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-300">Error</h3>
                <p className="text-red-200">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {!studyPlan ? (
          <div className="glass-card border border-white/10 rounded-2xl overflow-hidden">
            <StudyPlanForm onSubmit={handleFormSubmit} loading={loading} initialData={initialDataFromParams} />
          </div>
        ) : (
          <div className="space-y-6">
            <StudyPlanDisplay
              plan={studyPlan}
              formData={formData!}
              onReset={handleCreateNew}
            />
          </div>
        )}
      </div>
    </div>
  );
}