/*
  # Fix Study Groups Policies

  1. Changes
    - Drop existing problematic policies on study_groups table
    - Create new simplified policies for study_groups
    - Fix policies for study_group_members
    - Ensure foreign key constraint between group_messages and user_profiles

  2. Security
    - Allow all authenticated users to view all study groups
    - Allow users to create study groups if they're the creator
    - Allow group creators to update their own groups
    - Allow group creators to delete their own groups
    - Allow users to view their own memberships
    - Allow group creators to view all memberships in their groups
    - Allow users to join groups
    - Allow users to leave groups
*/

-- Drop existing problematic policies on study_groups
DROP POLICY IF EXISTS "Group creators can delete their groups" ON public.study_groups;
DROP POLICY IF EXISTS "Group creators can update their groups" ON public.study_groups;
DROP POLICY IF EXISTS "Users can create study groups" ON public.study_groups;
DROP POLICY IF EXISTS "Users can view all study groups" ON public.study_groups;

-- Create new simplified policies for study_groups
CREATE POLICY "Users can view all study groups" 
ON public.study_groups 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can create study groups" 
ON public.study_groups 
FOR INSERT 
TO authenticated 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creators can update their groups" 
ON public.study_groups 
FOR UPDATE 
TO authenticated 
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creators can delete their groups" 
ON public.study_groups 
FOR DELETE 
TO authenticated 
USING (created_by = auth.uid());

-- Fix policies for study_group_members
DROP POLICY IF EXISTS "Group creators can view all memberships in their groups" ON public.study_group_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.study_group_members;

CREATE POLICY "Users can view their own memberships" 
ON public.study_group_members 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Group creators can view all memberships in their groups" 
ON public.study_group_members 
FOR SELECT 
TO authenticated 
USING (
  group_id IN (
    SELECT id FROM public.study_groups 
    WHERE created_by = auth.uid()
  )
);

-- Ensure foreign key constraint between group_messages and user_profiles exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'group_messages_user_profiles_fk'
  ) THEN
    ALTER TABLE public.group_messages
    ADD CONSTRAINT group_messages_user_profiles_fk
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END$$;