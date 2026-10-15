import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { buildDailyResearch, researchFailure } from '../_shared/workspace-research.ts';

serve(async req => {
  const secret = Deno.env.get('WORKSPACE_RESEARCH_SECRET');
  if (req.method !== 'POST' || !secret || req.headers.get('X-Research-Secret') !== secret) return new Response('Unauthorized', {status:401});
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const work = async () => {
    // Atomic SKIP LOCKED claims keep overlapping cron invocations from duplicating work.
    const {data:job,error} = await db.rpc('claim_workspace_research');
    if (error) throw new Error('Research queue unavailable');
    if (!job) return;
    let status = 'ready', artifacts: unknown[] = [], failure: string | null = null;
    try { artifacts = await buildDailyResearch(db, job.user_id, job.id); }
    catch (error) { status = 'failed'; failure = researchFailure(error); }
    const {error:writeError} = await db.from('curve_workspace_research').update({status,artifacts,error:failure,updated_at:new Date().toISOString()}).eq('id',job.id).eq('user_id',job.user_id).eq('attempts',job.attempts);
    if (writeError) throw new Error('Could not save research');
    await db.from('curve_workspace_threads').update({research_next_at:new Date(Date.now() + (status === 'ready' || job.attempts >= 3 ? 86400000 : 1800000)).toISOString()}).eq('user_id',job.user_id);
  };
  const pending = Promise.allSettled([work(),work(),work()]);
  // The scheduled HTTP request returns immediately; work survives browser closure.
  EdgeRuntime.waitUntil(pending);
  return new Response(JSON.stringify({accepted:true}), {status:202,headers:{'Content-Type':'application/json'}});
});
