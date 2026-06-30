-- Supabase SQL Editor에서 실행하세요
-- Project Settings > SQL Editor

CREATE TABLE IF NOT EXISTS groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  color_index INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS todos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  text         TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  completed    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  group_id     UUID        REFERENCES groups(id) ON DELETE SET NULL,
  priority     TEXT        CHECK (priority IN ('high', 'normal', 'low'))
);

-- Row Level Security (인증 없이 anon key로 전체 접근 허용)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_groups" ON groups FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_todos"  ON todos  FOR ALL TO anon USING (true) WITH CHECK (true);
