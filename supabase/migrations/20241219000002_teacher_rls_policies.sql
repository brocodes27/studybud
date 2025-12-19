-- Add subject column to classes table if it doesn't exist
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS subject TEXT;

-- Update the name column to match web implementation
ALTER TABLE classes 
RENAME COLUMN class_name TO name;

-- Enable RLS on all teacher-related tables
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for classes table
CREATE POLICY "Teachers can view their own classes"
    ON classes FOR SELECT
    USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can create classes"
    ON classes FOR INSERT
    WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their own classes"
    ON classes FOR UPDATE
    USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own classes"
    ON classes FOR DELETE
    USING (teacher_id = auth.uid());

-- RLS Policies for class_members table
CREATE POLICY "Teachers can view members of their classes"
    ON class_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = class_members.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Students can view their own class memberships"
    ON class_members FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "Teachers can add members to their classes"
    ON class_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = class_members.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can remove members from their classes"
    ON class_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = class_members.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

-- RLS Policies for assignments table
CREATE POLICY "Teachers can manage assignments in their classes"
    ON assignments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = assignments.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Students can view assignments in their classes"
    ON assignments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM class_members
            WHERE class_members.class_id = assignments.class_id
            AND class_members.student_id = auth.uid()
        )
    );

-- RLS Policies for announcements table
CREATE POLICY "Teachers can manage announcements in their classes"
    ON announcements FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = announcements.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Students can view announcements in their classes"
    ON announcements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM class_members
            WHERE class_members.class_id = announcements.class_id
            AND class_members.student_id = auth.uid()
        )
    );
