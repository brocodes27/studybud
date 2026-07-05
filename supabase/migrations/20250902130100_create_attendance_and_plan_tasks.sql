-- Create attendance_events table
CREATE TABLE IF NOT EXISTS attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES exam_plans(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('present','absent','sick','holiday','other')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_events_user_date ON attendance_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_attendance_events_plan_id ON attendance_events(plan_id);
ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_events_select_own ON attendance_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY attendance_events_insert_own ON attendance_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY attendance_events_update_own ON attendance_events
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY attendance_events_delete_own ON attendance_events
  FOR DELETE USING (auth.uid() = user_id);
-- Create plan_tasks table for per-day tasks derived from exam_plans.plan
CREATE TABLE IF NOT EXISTS plan_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES exam_plans(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  task_date DATE,
  topic TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','skipped','rescheduled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, day)
);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_plan_id ON plan_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_status ON plan_tasks(status);
ALTER TABLE plan_tasks ENABLE ROW LEVEL SECURITY;
-- Allow users to access only tasks for plans they own
CREATE POLICY plan_tasks_select_own ON plan_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exam_plans p
      WHERE p.id = plan_tasks.plan_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY plan_tasks_insert_own ON plan_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_plans p
      WHERE p.id = plan_tasks.plan_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY plan_tasks_update_own ON plan_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM exam_plans p
      WHERE p.id = plan_tasks.plan_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY plan_tasks_delete_own ON plan_tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM exam_plans p
      WHERE p.id = plan_tasks.plan_id AND p.user_id = auth.uid()
    )
  );
