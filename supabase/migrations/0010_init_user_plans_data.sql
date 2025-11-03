-- Initialize user plans and usage for existing users
-- This migration script should be run after 0009_user_plans.sql

-- Step 1: Create beta plans for existing users who don't have a plan
INSERT INTO user_plans (user_id, plan_type, status, started_at)
SELECT DISTINCT owner_id, 'beta', 'active', NOW()
FROM documents
WHERE owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_plans WHERE user_plans.user_id = documents.owner_id
  )
ON CONFLICT DO NOTHING;

-- Step 2: Create usage records for current period for all users with plans
-- Calculate current usage from existing data
INSERT INTO user_usage (
  user_id,
  plan_id,
  period_start,
  period_end,
  storage_bytes_used,
  files_count,
  tokens_used,
  questions_count
)
SELECT 
  up.user_id,
  up.id AS plan_id,
  DATE(up.started_at) AS period_start,
  -- Calculate period_end (same day next month minus 1 day)
  CASE
    WHEN DATE_PART('month', up.started_at) = 12 THEN
      (DATE_TRUNC('year', up.started_at) + INTERVAL '1 year' + 
       (DATE_PART('day', up.started_at) || ' days')::INTERVAL - INTERVAL '1 day')::DATE
    ELSE
      (DATE_TRUNC('month', up.started_at) + INTERVAL '1 month' + 
       (DATE_PART('day', up.started_at) || ' days')::INTERVAL - INTERVAL '1 day')::DATE
  END AS period_end,
  COALESCE(storage_data.total_storage, 0) AS storage_bytes_used,
  COALESCE(file_data.file_count, 0) AS files_count,
  0 AS tokens_used, -- Historical token data not available
  COALESCE(question_data.question_count, 0) AS questions_count
FROM user_plans up
-- Get storage usage (sum of all documents)
LEFT JOIN (
  SELECT 
    owner_id,
    SUM(COALESCE(size_bytes, 0)) AS total_storage
  FROM documents
  WHERE owner_id IS NOT NULL
  GROUP BY owner_id
) storage_data ON storage_data.owner_id = up.user_id
-- Get file count
LEFT JOIN (
  SELECT 
    owner_id,
    COUNT(*) AS file_count
  FROM documents
  WHERE owner_id IS NOT NULL
  GROUP BY owner_id
) file_data ON file_data.owner_id = up.user_id
-- Get question count for current month
LEFT JOIN (
  SELECT 
    ct.user_id,
    COUNT(*) AS question_count
  FROM chat_messages cm
  JOIN chat_threads ct ON cm.thread_id = ct.id
  WHERE cm.role = 'user'
    AND DATE_TRUNC('month', cm.created_at) = DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY ct.user_id
) question_data ON question_data.user_id = up.user_id
WHERE up.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM user_usage 
    WHERE user_usage.user_id = up.user_id 
      AND user_usage.plan_id = up.id
      AND user_usage.period_start = DATE(up.started_at)
  )
ON CONFLICT (user_id, period_start) DO NOTHING;

