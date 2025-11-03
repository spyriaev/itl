-- User plans table
CREATE TABLE user_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('beta', 'base', 'plus')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on user_id
CREATE INDEX idx_user_plans_user ON user_plans(user_id);
CREATE INDEX idx_user_plans_status ON user_plans(status, started_at);

-- Plan limits configuration table
CREATE TABLE plan_limits (
  plan_type TEXT PRIMARY KEY CHECK (plan_type IN ('beta', 'base', 'plus')),
  max_storage_bytes BIGINT NOT NULL,
  max_files INTEGER, -- NULL means unlimited
  max_single_file_bytes BIGINT NOT NULL,
  max_tokens_per_month BIGINT NOT NULL,
  max_questions_per_month INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize plan limits
INSERT INTO plan_limits (plan_type, max_storage_bytes, max_files, max_single_file_bytes, max_tokens_per_month, max_questions_per_month) VALUES
  ('beta', 25 * 1024 * 1024, 10, 200 * 1024 * 1024, 100, 25),
  ('base', 25 * 1024 * 1024, NULL, 200 * 1024 * 1024, 100, 25),
  ('plus', 250 * 1024 * 1024, NULL, 200 * 1024 * 1024, 1000, 200);

-- User usage table (tracks usage per subscription period)
CREATE TABLE user_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES user_plans(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  storage_bytes_used BIGINT DEFAULT 0,
  files_count INTEGER DEFAULT 0,
  tokens_used BIGINT DEFAULT 0,
  questions_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);

-- Indexes for user_usage
CREATE INDEX idx_user_usage_user ON user_usage(user_id);
CREATE INDEX idx_user_usage_plan ON user_usage(plan_id);
CREATE INDEX idx_user_usage_period ON user_usage(user_id, period_start, period_end);

-- Update chat_messages table to track token usage
ALTER TABLE chat_messages 
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER,
  ADD COLUMN IF NOT EXISTS usage_tracked_at TIMESTAMPTZ;

-- Index for tokens_used (for analytics)
CREATE INDEX IF NOT EXISTS idx_chat_messages_tokens ON chat_messages(tokens_used) WHERE tokens_used IS NOT NULL;

-- RLS policies for user_plans
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own plans" ON user_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own plans" ON user_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plans" ON user_plans
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for plan_limits (public read access)
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plan limits" ON plan_limits
  FOR SELECT USING (true);

-- RLS policies for user_usage
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage" ON user_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own usage records" ON user_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage records" ON user_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to initialize default 'beta' plan for existing users
-- This will be called in a data migration script
CREATE OR REPLACE FUNCTION initialize_user_plan_for_existing_users()
RETURNS void AS $$
BEGIN
  -- Insert beta plans for users who don't have a plan yet
  INSERT INTO user_plans (user_id, plan_type, status, started_at)
  SELECT DISTINCT owner_id, 'beta', 'active', NOW()
  FROM documents
  WHERE owner_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM user_plans WHERE user_plans.user_id = documents.owner_id
    )
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

