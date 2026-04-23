import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { STANDARD_JEE_TEMPLATE } from './jee_coaching_template';

// Load env vars
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedTemplate() {
  console.log('Seeding Standard JEE Template...');

  const { data, error } = await supabase
    .from('coaching_templates')
    .insert([
      {
        institute_name: STANDARD_JEE_TEMPLATE.institute_name,
        program: STANDARD_JEE_TEMPLATE.program,
        year_level: STANDARD_JEE_TEMPLATE.year_level,
        description: STANDARD_JEE_TEMPLATE.description,
        weekly_schedule: STANDARD_JEE_TEMPLATE.weekly_schedule,
        test_calendar: STANDARD_JEE_TEMPLATE.test_calendar,
        total_weeks: STANDARD_JEE_TEMPLATE.total_weeks,
        is_active: true
      }
    ])
    .select();

  if (error) {
    console.error('Error seeding template:', error);
    process.exit(1);
  }

  console.log('Successfully seeded template!');
  console.log(data);
}

seedTemplate();
