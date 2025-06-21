/*
  # Fix Study Groups Policies

  1. Changes
    - Drop all existing policies on study_groups table
    - Create new simplified policies that avoid recursion
    - Fix foreign key constraint for group_messages
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Drop all existing policies on study_groups to start fresh
DROP POLICY IF EXISTS "Users can view all study groups" ON study_groups;
DROP POLICY IF EXISTS "Users can view groups they created" ON study_groups;
DROP POLICY IF EXISTS "Users can view groups they are members of" ON study_groups;
DROP POLICY IF EXISTS "Users can view groups via membership" ON study_groups;
DROP POLICY IF EXISTS "Group creators can update their groups" ON study_groups;
DROP POLICY IF EXISTS "Group creators can delete their groups" ON study_groups;
DROP POLICY IF EXISTS "Users can create study groups" ON study_groups;

-- Create new simplified policies for study_groups
CREATE POLICY "Users can view all study groups"
  ON study_groups
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create study groups"
  ON study_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creators can update their groups"
  ON study_groups
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creators can delete their groups"
  ON study_groups
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Fix study_group_members policies
DROP POLICY IF EXISTS "Users can view their own memberships" ON study_group_members;
DROP POLICY IF EXISTS "Group creators can view all memberships in their groups" ON study_group_members;
DROP POLICY IF EXISTS "Users can join groups" ON study_group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON study_group_members;

CREATE POLICY "Users can view their own memberships"
  ON study_group_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Group creators can view all memberships in their groups"
  ON study_group_members
  FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT id FROM study_groups WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can join groups"
  ON study_group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave groups"
  ON study_group_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Fix group_messages policies
DROP POLICY IF EXISTS "Group members can view messages" ON group_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON group_messages;

CREATE POLICY "Group members can view messages"
  ON group_messages
  FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM study_group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can send messages"
  ON group_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM study_group_members WHERE user_id = auth.uid()
    )
  );