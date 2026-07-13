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

-- Engagement History: Tracks follows, likes, DMs to avoid duplicates
CREATE TABLE IF NOT EXISTS engagement_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  action_type TEXT NOT NULL, -- follow, like, dm
  tweet_id TEXT,
  action_date TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_action CHECK (action_type IN ('follow', 'like', 'dm'))
);

-- Automation Settings: User preferences for automation
CREATE TABLE IF NOT EXISTS automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  auto_post_enabled BOOLEAN DEFAULT FALSE,
  auto_follow_enabled BOOLEAN DEFAULT FALSE,
  auto_like_enabled BOOLEAN DEFAULT FALSE,
  auto_dm_enabled BOOLEAN DEFAULT FALSE,
  post_interval_hours INTEGER DEFAULT 3, -- Post every N hours
  max_likes_per_day INTEGER DEFAULT 3,
  max_follows_per_day INTEGER DEFAULT 2,
  max_dms_per_day INTEGER DEFAULT 2,
  follow_delay_days INTEGER DEFAULT 2, -- Delay before following
  dm_delay_hours INTEGER DEFAULT 24, -- Delay before DMing
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Target Accounts: Accounts to follow/like from
CREATE TABLE IF NOT EXISTS target_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  account_handle TEXT NOT NULL,
  twitter_id TEXT,
  added_at TIMESTAMP DEFAULT NOW()
);

-- DM Templates: Personalized DM templates
CREATE TABLE IF NOT EXISTS dm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  template TEXT NOT NULL, -- Template with {handle}, {bio}, {followers} placeholders
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS for security
ALTER TABLE automation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY "Users can see own automation queue"
  ON automation_queue FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own automation queue"
  ON automation_queue FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can see own engagement history"
  ON engagement_history FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can see own settings"
  ON automation_settings FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own settings"
  ON automation_settings FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can see own target accounts"
  ON target_accounts FOR SELECT
  USING (auth.uid()::text = user_id);

-- Niche Keywords: Keywords to search for users in your niche
CREATE TABLE IF NOT EXISTS niche_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL, -- e.g., "founder", "saas", "startup"
  search_frequency TEXT DEFAULT 'daily', -- daily, twice_daily
  last_searched TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, keyword)
);

-- User Discovery Candidates: Users discovered matching niche keywords
CREATE TABLE IF NOT EXISTS user_discovery_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Your user ID
  target_twitter_id TEXT NOT NULL,
  target_handle TEXT NOT NULL,
  target_name TEXT,
  target_bio TEXT,
  followers_count INTEGER,
  engagement_score INTEGER DEFAULT 0, -- 0-100 based on engagement potential
  keyword_matched TEXT, -- Which keyword matched
  discovered_at TIMESTAMP DEFAULT NOW(),
  followed_at TIMESTAMP,
  engaged_at TIMESTAMP,
  status TEXT DEFAULT 'discovered', -- discovered, followed, engaged, skipped
  reason_skipped TEXT,
  CONSTRAINT valid_status CHECK (status IN ('discovered', 'followed', 'engaged', 'skipped')),
  UNIQUE(user_id, target_twitter_id)
);

-- Enable RLS
ALTER TABLE niche_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_discovery_candidates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can see own keywords"
  ON niche_keywords FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage own keywords"
  ON niche_keywords FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can see own candidates"
  ON user_discovery_candidates FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own candidates"
  ON user_discovery_candidates FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS automation_queue_user_status ON automation_queue(user_id, status);
CREATE INDEX IF NOT EXISTS engagement_history_user_target ON engagement_history(user_id, target_user_id, action_type);
CREATE INDEX IF NOT EXISTS automation_settings_user ON automation_settings(user_id);
CREATE INDEX IF NOT EXISTS niche_keywords_user ON niche_keywords(user_id);
CREATE INDEX IF NOT EXISTS user_discovery_candidates_user_status ON user_discovery_candidates(user_id, status);
CREATE INDEX IF NOT EXISTS user_discovery_candidates_score ON user_discovery_candidates(engagement_score DESC);
