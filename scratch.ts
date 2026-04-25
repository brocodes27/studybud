import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: prescriptions, error } = await supabase.from('daily_prescriptions').select('*');
  if (!prescriptions) return;

  const grouped: Record<string, any[]> = {};
  for (const p of prescriptions) {
    const key = `${p.user_id}_${p.prescription_date}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  for (const key in grouped) {
    const pres = grouped[key];
    if (pres.length > 1) {
      console.log(`Found ${pres.length} duplicates for ${key}`);
      // Sort by created_at ascending
      pres.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      // Keep the EARLIEST one (which probably has the outputs)
      const toKeep = pres[0];
      const toDelete = pres.slice(1).map(p => p.id);
      
      console.log(`Keeping ${toKeep.id}, deleting ${toDelete.length} others`);
      const { error: delErr } = await supabase.from('daily_prescriptions').delete().in('id', toDelete);
      if (delErr) console.error("Error deleting:", delErr);
    }
  }
}
run();
