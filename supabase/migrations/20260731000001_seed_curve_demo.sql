-- ============================================
-- Seed data for Curve: US college course model catalog
-- ============================================

do $$
declare
  orgo_id uuid;
  calc_id uuid;
  phys_id uuid;
  econ_id uuid;
begin
  -- 1. Organic Chemistry I (CHEM 2210)
  insert into public.curve_courses (
    id, institution_name, course_code, title, instructor_name, term, credit_hours, is_catalog
  ) values (
    gen_random_uuid(), 'UC Berkeley', 'CHEM 2210', 'Organic Chemistry I', 'Prof. David Evans', 'Fall 2026', 4.0, true
  ) returning id into orgo_id;

  insert into public.curve_grading_components (course_id, name, kind, weight, drop_lowest, due_on, position) values
    (orgo_id, 'Problem Sets (10)', 'homework', 20.0, 1, current_date + 7, 0),
    (orgo_id, 'Midterm 1', 'midterm', 20.0, 0, current_date + 14, 1),
    (orgo_id, 'Midterm 2', 'midterm', 20.0, 0, current_date + 42, 2),
    (orgo_id, 'Final Examination', 'final', 40.0, 0, current_date + 75, 3);

  -- 2. Calculus III (MATH 2400)
  insert into public.curve_courses (
    id, institution_name, course_code, title, instructor_name, term, credit_hours, is_catalog
  ) values (
    gen_random_uuid(), 'UC Berkeley', 'MATH 2400', 'Multivariable Calculus', 'Prof. Elena Rostova', 'Fall 2026', 4.0, true
  ) returning id into calc_id;

  insert into public.curve_grading_components (course_id, name, kind, weight, drop_lowest, due_on, position) values
    (calc_id, 'Weekly Quizzes', 'quiz', 15.0, 2, current_date + 5, 0),
    (calc_id, 'Homework Assignments', 'homework', 15.0, 1, current_date + 8, 1),
    (calc_id, 'Midterm Exam', 'midterm', 30.0, 0, current_date + 21, 2),
    (calc_id, 'Final Exam', 'final', 40.0, 0, current_date + 77, 3);

  -- 3. General Physics I (PHYS 1100)
  insert into public.curve_courses (
    id, institution_name, course_code, title, instructor_name, term, credit_hours, is_catalog
  ) values (
    gen_random_uuid(), 'UC Berkeley', 'PHYS 1100', 'General Physics: Mechanics', 'Prof. Marcus Vance', 'Fall 2026', 4.0, true
  ) returning id into phys_id;

  insert into public.curve_grading_components (course_id, name, kind, weight, drop_lowest, due_on, position) values
    (phys_id, 'Lab Reports', 'lab', 25.0, 0, current_date + 10, 0),
    (phys_id, 'Homework', 'homework', 15.0, 1, current_date + 6, 1),
    (phys_id, 'Midterm Exam', 'midterm', 25.0, 0, current_date + 28, 2),
    (phys_id, 'Final Exam', 'final', 35.0, 0, current_date + 80, 3);

  -- 4. Principles of Macroeconomics (ECON 2010)
  insert into public.curve_courses (
    id, institution_name, course_code, title, instructor_name, term, credit_hours, is_catalog
  ) values (
    gen_random_uuid(), 'UC Berkeley', 'ECON 2010', 'Principles of Macroeconomics', 'Prof. Sarah Jenkins', 'Fall 2026', 3.0, true
  ) returning id into econ_id;

  insert into public.curve_grading_components (course_id, name, kind, weight, drop_lowest, due_on, position) values
    (econ_id, 'Problem Sets', 'homework', 20.0, 1, current_date + 4, 0),
    (econ_id, 'Class Participation', 'participation', 10.0, 0, current_date + 60, 1),
    (econ_id, 'Midterm Exam', 'midterm', 30.0, 0, current_date + 35, 2),
    (econ_id, 'Final Exam', 'final', 40.0, 0, current_date + 82, 3);

end $$;
