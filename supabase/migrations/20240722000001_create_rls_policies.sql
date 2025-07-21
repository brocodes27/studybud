-- Enable RLS for all new tables
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policies for 'classes' table
-- Teachers can create classes
CREATE POLICY "Allow teachers to create classes"
ON classes FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'teacher'
);

-- Teachers can view their own classes
CREATE POLICY "Allow teachers to view their own classes"
ON classes FOR SELECT
TO authenticated
USING (
    teacher_id = auth.uid()
);

-- Students can view classes they are members of
CREATE POLICY "Allow students to view their classes"
ON classes FOR SELECT
TO authenticated
USING (
    id IN (SELECT class_id FROM class_members WHERE student_id = auth.uid())
);

-- Policies for 'class_members' table
-- Students can join a class
CREATE POLICY "Allow students to join a class"
ON class_members FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'student'
);

-- Members can view their own membership
CREATE POLICY "Allow members to view their own membership"
ON class_members FOR SELECT
TO authenticated
USING (
    student_id = auth.uid()
);

-- Teachers can view all members of their classes
CREATE POLICY "Allow teachers to view members of their classes"
ON class_members FOR SELECT
TO authenticated
USING (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
);

-- Policies for 'assignments' table
-- Teachers can create assignments for their classes
CREATE POLICY "Allow teachers to create assignments"
ON assignments FOR INSERT
TO authenticated
WITH CHECK (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
);

-- Teachers can view assignments for their classes
CREATE POLICY "Allow teachers to view assignments"
ON assignments FOR SELECT
TO authenticated
USING (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
);

-- Students can view assignments for their classes
CREATE POLICY "Allow students to view assignments"
ON assignments FOR SELECT
TO authenticated
USING (
    class_id IN (SELECT class_id FROM class_members WHERE student_id = auth.uid())
);

-- Policies for 'announcements' table
-- Teachers can create announcements for their classes
CREATE POLICY "Allow teachers to create announcements"
ON announcements FOR INSERT
TO authenticated
WITH CHECK (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
);

-- Teachers can view announcements for their classes
CREATE POLICY "Allow teachers to view announcements"
ON announcements FOR SELECT
TO authenticated
USING (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
);

-- Students can view announcements for their classes
CREATE POLICY "Allow students to view announcements"
ON announcements FOR SELECT
TO authenticated
USING (
    class_id IN (SELECT class_id FROM class_members WHERE student_id = auth.uid())
); 