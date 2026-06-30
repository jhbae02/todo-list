-- Supabase SQL Editor에서 실행 (기존 테이블에 user_id 추가 + RLS 변경)

-- 1. user_id 컬럼 추가
ALTER TABLE groups ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE todos  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. 기존 anon 정책 제거
DROP POLICY IF EXISTS "anon_all_groups" ON groups;
DROP POLICY IF EXISTS "anon_all_todos"  ON todos;

-- 3. 인증된 사용자만 본인 데이터 접근
CREATE POLICY "user_own_groups" ON groups FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_own_todos" ON todos FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
