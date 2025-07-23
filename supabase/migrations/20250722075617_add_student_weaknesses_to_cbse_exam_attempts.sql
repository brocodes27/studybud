-- Add student_weaknesses column to cbse_exam_attempts
ALTER TABLE cbse_exam_attempts ADD COLUMN IF NOT EXISTS student_weaknesses text; 