/*
  # Fix Study Groups Policy Recursion

  1. Changes
    - Drop all existing policies on study_groups table
    - Create new non-recursive policies for study_groups
    - Simplify the policy structure to avoid circular references
*/

-- Drop all existing policies on study_groups to start fresh
DROP POLICY IF EXISTS "Users can view all study groups" ON study_groups;
DROP POLICY IF EXISTS "Users can view groups they created" ON study_groups;
DROP POLICY IF EXISTS "Users can view groups via membership" ON study_groups;
DROP POLICY IF EXISTS "Users can view groups they are members of" ON study_groups;
DROP POLICY IF EXISTS "Users can view joined groups" ON study_groups;
DROP POLICY IF EXISTS "Users can view their own groups" ON study_groups;
DROP POLICY IF EXISTS "Group creators can update their groups" ON study_groups;
DROP POLICY IF EXISTS "Group creators can delete their groups" ON study_groups;
DROP POLICY IF EXISTS "Users can create study groups" ON study_groups;

-- Create new simplified policies without recursion
-- Allow all authenticated users to view all study groups
CREATE POLICY "Users can view all study groups"
  ON study_groups
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to create study groups
CREATE POLICY "Users can create study groups"
  ON study_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Allow group creators to update their groups
CREATE POLICY "Group creators can update their groups"
  ON study_groups
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Allow group creators to delete their groups
CREATE POLICY "Group creators can delete their groups"
  ON study_groups
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());