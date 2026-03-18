-- =============================================
-- 교회 투표 시스템 - Supabase 테이블 생성 SQL
-- Supabase > SQL Editor 에서 실행하세요
-- =============================================

-- 1. 투표 세션 테이블
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  role        TEXT NOT NULL,
  vote_type   TEXT NOT NULL CHECK (vote_type IN ('single', 'multi', 'yesno')),
  max_pick    INT NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 후보자 테이블
CREATE TABLE candidates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  vote_count  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 찬반 투표용 기본 후보 자동 삽입 트리거
CREATE OR REPLACE FUNCTION insert_yesno_candidates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vote_type = 'yesno' THEN
    INSERT INTO candidates (session_id, name, description)
    VALUES
      (NEW.id, '찬성', ''),
      (NEW.id, '반대', ''),
      (NEW.id, '기권', '');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_yesno_candidates
AFTER INSERT ON sessions
FOR EACH ROW EXECUTE FUNCTION insert_yesno_candidates();

-- 3. 투표자 명부 테이블
CREATE TABLE voters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,          -- 등록번호 or 생년월일
  has_voted   BOOLEAN NOT NULL DEFAULT FALSE,
  voted_at    TIMESTAMPTZ,
  UNIQUE(session_id, name, code)      -- 중복 방지
);

-- =============================================
-- Row Level Security (선택 사항, 보안 강화 시)
-- =============================================
-- ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE voters ENABLE ROW LEVEL SECURITY;
