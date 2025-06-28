/*
  # Storytelling App Database Schema

  1. New Tables
    - `user_profiles` - Extended user information and preferences
    - `stories` - User recorded stories with metadata
    - `story_feedback` - AI-generated feedback for stories
    - `achievements` - Available achievements in the system
    - `user_achievements` - User's earned achievements
    - `user_stats` - Aggregated user statistics

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Public read access for achievements table

  3. Storage
    - Create audio_recordings bucket for story files
    - Set up proper access policies
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  preferred_feedback_style text DEFAULT 'encouraging',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stories table
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  genre text NOT NULL,
  prompt text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  audio_url text,
  transcript text,
  feedback_personality text NOT NULL DEFAULT 'encouraging',
  processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create story_feedback table
CREATE TABLE IF NOT EXISTS story_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  feedback_text text NOT NULL,
  strengths text[] DEFAULT '{}',
  improvements text[] DEFAULT '{}',
  next_steps text[] DEFAULT '{}',
  overall_score integer CHECK (overall_score >= 1 AND overall_score <= 10),
  created_at timestamptz DEFAULT now()
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  achievement_type text NOT NULL,
  criteria jsonb NOT NULL,
  points integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_id text REFERENCES achievements(id) ON DELETE CASCADE NOT NULL,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_stories integer DEFAULT 0,
  total_minutes integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  favorite_genre text,
  last_story_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
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

-- Create policies for stories
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

-- Create policies for story_feedback
CREATE POLICY "Users can read feedback for own stories"
  ON story_feedback
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stories 
      WHERE stories.id = story_feedback.story_id 
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert feedback"
  ON story_feedback
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create policies for achievements (public read)
CREATE POLICY "Anyone can read achievements"
  ON achievements
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for user_achievements
CREATE POLICY "Users can read own achievements"
  ON user_achievements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert user achievements"
  ON user_achievements
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create policies for user_stats
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

-- Insert default achievements
INSERT INTO achievements (id, title, description, icon, achievement_type, criteria, points) VALUES
  ('first_story', 'First Story', 'Recorded your very first story', '🎯', 'milestone', '{"stories_count": 1}', 10),
  ('week_warrior', 'Week Warrior', 'Maintained a 7-day streak', '🔥', 'streak', '{"streak_days": 7}', 25),
  ('genre_explorer', 'Genre Explorer', 'Tried all 6 story genres', '🗺️', 'variety', '{"unique_genres": 6}', 50),
  ('marathon_storyteller', 'Marathon Storyteller', 'Recorded a 15-minute story', '⏰', 'duration', '{"min_duration": 900}', 30),
  ('century_club', 'Century Club', 'Recorded 100 stories', '💯', 'milestone', '{"stories_count": 100}', 100),
  ('master_storyteller', 'Master Storyteller', 'Achieved 30-day streak', '👑', 'streak', '{"streak_days": 30}', 75)
ON CONFLICT (id) DO NOTHING;

-- Create functions for updating stats
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user stats when a new story is added
  INSERT INTO user_stats (user_id, total_stories, total_minutes, last_story_date)
  VALUES (NEW.user_id, 1, NEW.duration_seconds / 60, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE SET
    total_stories = user_stats.total_stories + 1,
    total_minutes = user_stats.total_minutes + (NEW.duration_seconds / 60),
    last_story_date = CURRENT_DATE,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating stats
DROP TRIGGER IF EXISTS update_stats_on_story_insert ON stories;
CREATE TRIGGER update_stats_on_story_insert
  AFTER INSERT ON stories
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats();

-- Create function to calculate streaks
CREATE OR REPLACE FUNCTION calculate_user_streak(user_uuid uuid)
RETURNS integer AS $$
DECLARE
  streak_count integer := 0;
  check_date date := CURRENT_DATE;
  story_exists boolean;
BEGIN
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM stories 
      WHERE user_id = user_uuid 
      AND DATE(created_at) = check_date
    ) INTO story_exists;
    
    IF NOT story_exists THEN
      EXIT;
    END IF;
    
    streak_count := streak_count + 1;
    check_date := check_date - INTERVAL '1 day';
  END LOOP;
  
  RETURN streak_count;
END;
$$ LANGUAGE plpgsql;