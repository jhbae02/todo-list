-- Supabase SQL Editor에서 실행 (due_date 컬럼 추가)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date DATE;
