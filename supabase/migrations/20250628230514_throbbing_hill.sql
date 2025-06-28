/*
  # Fix Foreign Key References to Auth Users

  1. Problem
    - Foreign keys are referencing `users(id)` but should reference `auth.users(id)`
    - This causes issues when trying to create user profiles and stats

  2. Solution
    - Drop existing foreign key constraints
    - Recreate them with proper references to `auth.users(id)`
    - Ensure all user-related tables properly reference the auth system
*/

-- Drop existing foreign key constraints that reference non-existent users table
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_user_id_fkey;
ALTER TABLE user_achievements DROP CONSTRAINT IF EXISTS user_achievements_user_id_fkey;
ALTER TABLE user_stats DROP CONSTRAINT IF EXISTS user_stats_user_id_fkey;

-- Recreate foreign key constraints with proper references to auth.users
ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE stories 
ADD CONSTRAINT stories_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE user_achievements 
ADD CONSTRAINT user_achievements_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE user_stats 
ADD CONSTRAINT user_stats_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Ensure RLS policies are properly set up for auth.uid()
-- Update any policies that might be using incorrect user references

-- Update user_profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Update stories policies
DROP POLICY IF EXISTS "Users can read own stories" ON stories;
DROP POLICY IF EXISTS "Users can insert own stories" ON stories;
DROP POLICY IF EXISTS "Users can update own stories" ON stories;

CREATE POLICY "Users can read own stories"
  ON stories
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stories"
  ON stories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stories"
  ON stories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update user_achievements policies
DROP POLICY IF EXISTS "Users can read own achievements" ON user_achievements;

CREATE POLICY "Users can read own achievements"
  ON user_achievements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Update user_stats policies
DROP POLICY IF EXISTS "Users can read own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can insert own stats" ON user_stats;

CREATE POLICY "Users can read own stats"
  ON user_stats
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own stats"
  ON user_stats
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats"
  ON user_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);