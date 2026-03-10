import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

import { StudyPlanForm, FormData } from '../components/StudyPlanForm';
import { StudyPlanDisplay } from '../components/StudyPlanDisplay';
import { Brain, AlertCircle, Sparkles, Target, Zap } from 'lucide-react';

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
          if (errorData.details) {
            errorMessage = `${errorData.error || errorMessage}: ${errorData.details}`;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          errorMessage = `${errorMessage} (Status: ${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const plan = await response.json();
      setStudyPlan(plan);
      setFormData(data);

      if (data.plan_name) {
        let updateErr = null;
        if (plan && (plan as any).id) {
          const { error: nameErr } = await supabase
            .from('exam_plans')
            .update({ plan_name: data.plan_name })
            .eq('id', (plan as any).id);
          updateErr = nameErr;
        } else {
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
    <div className="max-w-6xl mx-auto py-12 px-6 space-y-10 animate-fade-in">
      {/* Header */}
      <div className="mb-10 flex items-center gap-4">
        <div className="w-14 h-14 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[20px] flex items-center justify-center shadow-float-cyan">
          <Brain className="h-7 w-7 text-[#00D1FF] stroke-[2.5px]" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-[#0A192F] tracking-tight">Create Study Plan</h1>
          <p className="text-[#64748B] font-medium">AI-powered personalized study schedule</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-[24px] p-6 flex items-center gap-4">
          <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
          <p className="font-medium text-red-700">{error}</p>
        </div>
      )}

      {/* Main Content Area */}
      {!studyPlan ? (
        <div className="neo-card">
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#0A192F]/5">
            <Sparkles className="h-5 w-5 text-[#00D1FF]" />
            <span className="font-bold text-[#64748B] text-sm">Fill in the details below to generate your plan</span>
          </div>
          <StudyPlanForm onSubmit={handleFormSubmit} loading={loading} initialData={initialDataFromParams} />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="neo-card flex justify-between items-center">
            <div className="font-extrabold text-xl text-[#0A192F] tracking-tight flex items-center gap-2">
              <Target className="h-5 w-5 text-[#34D399]" />
              Plan Generated Successfully
            </div>
            <button
              onClick={handleCreateNew}
              className="px-5 py-2 rounded-full bg-[#0A192F] text-white font-bold text-sm hover:-translate-y-0.5 active:scale-95 transition-all"
            >
              Create Another
            </button>
          </div>
          <StudyPlanDisplay
            plan={studyPlan}
            formData={formData!}
            onReset={handleCreateNew}
          />
        </div>
      )}
    </div>
  );
}
