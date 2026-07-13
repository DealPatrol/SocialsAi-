-- Automation Queue: Stores tweets to be posted
CREATE TABLE IF NOT EXISTS automation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tweet_content TEXT NOT NULL,
  scheduled_for TIMESTAMP NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMP,
  status TEXT DEFAULT 'pending', -- pending, posted, failed
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'posted', 'failed'))
);

-- Automation Settings: User preferences for automation
CREATE TABLE IF NOT EXISTS automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  auto_post_enabled BOOLEAN DEFAULT FALSE,
  suggestions_enabled BOOLEAN DEFAULT FALSE,
  post_interval_hours INTEGER DEFAULT 3, -- Post every N hours
  max_suggestions_per_day INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Reply Suggestions: AI-drafted replies to recent public tweets from
-- target accounts. These are read-only research + a Claude-drafted
-- reply — nothing is ever posted, followed, or DMed automatically.
-- A human reviews, edits, and explicitly posts each suggestion.
CREATE TABLE IF NOT EXISTS reply_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  target_handle TEXT NOT NULL,
  target_tweet_id TEXT NOT NULL,
  target_tweet_text TEXT NOT NULL,
  suggested_reply TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, dismissed, posted
  posted_tweet_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_suggestion_status CHECK (status IN ('pending', 'dismissed', 'posted')),
  CONSTRAINT unique_suggestion_per_tweet UNIQUE (user_id, target_tweet_id)
);

-- Migration for projects that already ran an earlier version of this
-- schema: drop the mass-follow/like/DM tables and columns. Automated
-- following, liking, and DMing of strangers risks Twitter/X spam
-- enforcement and account suspension, so that functionality has been
-- replaced with human-reviewed reply suggestions above.
DROP TABLE IF EXISTS engagement_history;
DROP TABLE IF EXISTS target_accounts;
DROP TABLE IF EXISTS dm_templates;

ALTER TABLE automation_settings DROP COLUMN IF EXISTS auto_follow_enabled;
ALTER TABLE automation_settings DROP COLUMN IF EXISTS auto_like_enabled;
ALTER TABLE automation_settings DROP COLUMN IF EXISTS auto_dm_enabled;
ALTER TABLE automation_settings DROP COLUMN IF EXISTS max_likes_per_day;
ALTER TABLE automation_settings DROP COLUMN IF EXISTS max_follows_per_day;
ALTER TABLE automation_settings DROP COLUMN IF EXISTS max_dms_per_day;
ALTER TABLE automation_settings DROP COLUMN IF EXISTS follow_delay_days;
ALTER TABLE automation_settings DROP COLUMN IF EXISTS dm_delay_hours;
ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS suggestions_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS max_suggestions_per_day INTEGER DEFAULT 5;

-- Enable RLS for security
ALTER TABLE automation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY "Users can see own automation queue"
  ON automation_queue FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own automation queue"
  ON automation_queue FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can see own settings"
  ON automation_settings FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own settings"
  ON automation_settings FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can see own reply suggestions"
  ON reply_suggestions FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own reply suggestions"
  ON reply_suggestions FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS automation_queue_user_status ON automation_queue(user_id, status);
CREATE INDEX IF NOT EXISTS automation_settings_user ON automation_settings(user_id);
CREATE INDEX IF NOT EXISTS reply_suggestions_user_status ON reply_suggestions(user_id, status, created_at);
