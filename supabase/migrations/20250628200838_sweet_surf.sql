/*
  # Complete StoryTeller App Setup

  1. Achievements Data
    - Insert predefined achievements into the achievements table
  
  2. Database Functions
    - Create the update_user_stats function that's referenced in triggers
  
  3. Additional Indexes
    - Add performance indexes for common queries
*/

-- Insert predefined achievements
INSERT INTO achievements (id, title, description, icon, achievement_type, criteria, points) VALUES
  ('first_story', 'First Story', 'Recorded your very first story', '🎯', 'milestone', '{"stories_count": 1}', 10),
  ('week_warrior', 'Week Warrior', 'Maintained a 7-day streak', '🔥', 'streak', '{"streak_days": 7}', 25),
  ('genre_explorer', 'Genre Explorer', 'Tried all 6 story genres', '🗺️', 'variety', '{"unique_genres": 6}', 30),
  ('marathon_storyteller', 'Marathon Storyteller', 'Recorded a 15-minute story', '⏰', 'duration', '{"min_duration_seconds": 900}', 20),
  ('century_club', 'Century Club', 'Recorded 100 stories', '💯', 'milestone', '{"stories_count": 100}', 100),
  ('master_storyteller', 'Master Storyteller', 'Achieved 30-day streak', '👑', 'streak', '{"streak_days": 30}', 75)
ON CONFLICT (id) DO NOTHING;

-- Create the update_user_stats function
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
DECLARE
  user_stats_record user_stats%ROWTYPE;
  story_date DATE;
  days_diff INTEGER;
BEGIN
  -- Get the date of the new story
  story_date := NEW.created_at::DATE;
  
  -- Get or create user stats record
  SELECT * INTO user_stats_record 
  FROM user_stats 
  WHERE user_id = NEW.user_id;
  
  IF NOT FOUND THEN
    -- Create new stats record
    INSERT INTO user_stats (
      user_id, 
      total_stories, 
      total_minutes, 
      current_streak, 
      longest_streak, 
      last_story_date
    ) VALUES (
      NEW.user_id, 
      1, 
      CEIL(NEW.duration_seconds / 60.0), 
      1, 
      1, 
      story_date
    );
  ELSE
    -- Calculate days difference
    days_diff := story_date - user_stats_record.last_story_date;
    
    -- Update existing stats
    UPDATE user_stats SET
      total_stories = user_stats_record.total_stories + 1,
      total_minutes = user_stats_record.total_minutes + CEIL(NEW.duration_seconds / 60.0),
      current_streak = CASE 
        WHEN days_diff = 1 THEN user_stats_record.current_streak + 1
        WHEN days_diff = 0 THEN user_stats_record.current_streak -- Same day
        ELSE 1 -- Reset streak
      END,
      longest_streak = GREATEST(
        user_stats_record.longest_streak,
        CASE 
          WHEN days_diff = 1 THEN user_stats_record.current_streak + 1
          WHEN days_diff = 0 THEN user_stats_record.current_streak
          ELSE 1
        END
      ),
      last_story_date = story_date,
      favorite_genre = (
        SELECT genre 
        FROM stories 
        WHERE user_id = NEW.user_id 
        GROUP BY genre 
        ORDER BY COUNT(*) DESC 
        LIMIT 1
      ),
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_stories_user_created ON stories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_processing_status ON stories(processing_status);
CREATE INDEX IF NOT EXISTS idx_story_feedback_story_id ON story_feedback(story_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

-- Ensure RLS is enabled on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;