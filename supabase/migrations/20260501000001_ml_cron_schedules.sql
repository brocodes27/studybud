-- ML Cron Schedules
-- pg_cron jobs for all ML pipeline functions
-- Hardcoded URLs for this project

-- IRT Calibration: Sunday 3am UTC
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'irt-calibrate-weekly') THEN
    PERFORM cron.schedule('irt-calibrate-weekly', '0 3 * * 0',
      E'SELECT net.http_post(url:=''https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/irt-calibrate'',headers:=ARRAY[''Content-Type:application/json'',''Authorization:Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A''])');
  END IF;
END $$;

-- BKT Tuning: 1st of month 4am UTC
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bkt-tune-monthly') THEN
    PERFORM cron.schedule('bkt-tune-monthly', '0 4 1 * *',
      E'SELECT net.http_post(url:=''https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/bkt-tune'',headers:=ARRAY[''Content-Type:application/json'',''Authorization:Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A''])');
  END IF;
END $$;

-- Agent Corrections Analysis: Daily 6am UTC
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-analyze-daily') THEN
    PERFORM cron.schedule('agent-analyze-daily', '0 6 * * *',
      E'SELECT net.http_post(url:=''https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/agent-analyze-corrections'',headers:=ARRAY[''Content-Type:application/json'',''Authorization:Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A''])');
  END IF;
END $$;

-- Score Model Retraining: 15th of month 4am UTC
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'score-model-monthly') THEN
    PERFORM cron.schedule('score-model-monthly', '0 4 15 * *',
      E'SELECT net.http_post(url:=''https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/train-score-model'',headers:=ARRAY[''Content-Type:application/json'',''Authorization:Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A''])');
  END IF;
END $$;