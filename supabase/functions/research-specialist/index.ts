import {serve} from 'https://deno.land/std@0.168.0/http/server.ts';
import {specialistHandler} from '../_shared/a2a-specialist.ts';
import {researchTopic} from '../_shared/research-topic.ts';
serve(specialistHandler({url:`${Deno.env.get('SUPABASE_URL')}/functions/v1/research-specialist`,token:Deno.env.get('A2A_RESEARCH_TOKEN')},researchTopic));
