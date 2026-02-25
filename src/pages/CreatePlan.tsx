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
    <div className="max-w-6xl mx-auto py-12 px-6 space-y-12 text-slate-100">
      {/* Neo-Brutalist Header */}
      <div className="relative">
        <div className="sticker bg-neo-secondary mb-4 text-sm inline-block px-3 py-1 border border-white/10 rotate-1">AI_GENERATOR_v5.0</div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter leading-none">
              NEW <span className="text-stroke-neo text-slate-100">PLAN</span>
            </h1>
            <p className="text-xl font-bold text-slate-100/60 mt-4 max-w-xl">
              Map your path to the 1600. Expert scaling, adaptive timeline, and rigor-first scheduling.
            </p>
          </div>
          <div className="flex gap-4">
             <div className="bg-slate-800 border border-white/10 p-4 shadow-neo rotate-2">
                <Target className="h-6 w-6 text-neo-accent" />
             </div>
             <div className="bg-slate-800 border border-white/10 p-4 shadow-neo -rotate-2">
                <Zap className="h-6 w-6 text-neo-secondary" />
             </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="neo-card bg-red-500/10 border-red-500 p-6 flex items-center gap-4">
          <AlertCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
          <div>
            <h3 className="font-black uppercase text-sm italic">Generation Error</h3>
            <p className="font-bold text-red-900/70">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-12">
        {!studyPlan ? (
          <div className="neo-card bg-slate-800 border border-white/10 p-8 md:p-12 shadow-neo">
            <div className="flex items-center gap-3 mb-10 border-b-4 border-white/10 pb-4">
               <Sparkles className="h-6 w-6 text-neo-accent" />
               <span className="font-black uppercase tracking-widest text-sm italic">Input_Parameters</span>
            </div>
            <StudyPlanForm onSubmit={handleFormSubmit} loading={loading} initialData={initialDataFromParams} />
          </div>
        ) : (
          <div className="space-y-12">
            <div className="neo-card bg-neo-secondary/10 border border-white/10 p-6 flex justify-between items-center">
               <div className="font-black italic text-2xl uppercase tracking-tighter">Plan Generated Successfully</div>
               <button onClick={handleCreateNew} className="neo-button-white px-6 py-2 text-xs">CREATE ANOTHER</button>
            </div>
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
