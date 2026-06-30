-- Supabase SQL Editor에서 실행하세요
-- Project Settings > SQL Editor

CREATE TABLE IF NOT EXISTS groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  color_index INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  text         TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  completed    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  group_id     UUID        REFERENCES groups(id) ON DELETE SET NULL,
  priority     TEXT        CHECK (priority IN ('high', 'normal', 'low')),
  due_date     DATE,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Row Level Security (로그인한 사용자만 본인 데이터 접근)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos  ENABLE ROW LEVEL SECURITY;

-- 기존 anon 정책 제거
DROP POLICY IF EXISTS "anon_all_groups" ON groups;
DROP POLICY IF EXISTS "anon_all_todos"  ON todos;

-- 인증된 사용자: 본인 데이터만 접근
CREATE POLICY "user_own_groups" ON groups FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_own_todos" ON todos FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
