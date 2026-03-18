# ✝️ 교회 투표 시스템 - 백엔드 API

Node.js + Express + Supabase(PostgreSQL) 기반 백엔드 서버입니다.
Render에서 무료로 호스팅할 수 있습니다.

---

## 📁 파일 구조

```
church-vote-api/
├── src/
│   ├── index.js              # 서버 진입점
│   ├── supabase.js           # DB 클라이언트
│   ├── middleware/
│   │   └── adminAuth.js      # 관리자 JWT 인증
│   └── routes/
│       ├── admin.js          # 관리자 API
│       └── vote.js           # 투표자 API
├── supabase_setup.sql        # DB 테이블 생성 SQL
├── .env.example              # 환경변수 예시
└── package.json
```

---

## 🚀 로컬 실행

```bash
# 1. 패키지 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일 열어서 Supabase 정보 입력

# 3. 개발 서버 실행
npm run dev
```

---

## 🗄️ Supabase 설정

1. https://supabase.com 에서 무료 계정 생성
2. 새 프로젝트 생성 (지역: Northeast Asia)
3. **SQL Editor** 탭에서 `supabase_setup.sql` 내용 전체 실행
4. **Settings > API** 에서 다음 값 복사:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` 키 → `SUPABASE_SERVICE_KEY`
5. **SQL Editor** 에서 increment_vote 함수 추가 실행:

```sql
-- 득표수 원자적 증가 함수 (동시 요청 안전)
CREATE OR REPLACE FUNCTION increment_vote(candidate_id UUID, session_id UUID)
RETURNS VOID AS $$
  UPDATE candidates
  SET vote_count = vote_count + 1
  WHERE id = candidate_id AND session_id = increment_vote.session_id;
$$ LANGUAGE SQL;
```

---

## ☁️ Render 배포

1. GitHub에 이 폴더를 저장소로 push
2. https://render.com 에서 **New > Web Service**
3. 저장소 연결
4. 설정:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. **Environment Variables** 탭에서 `.env` 값 입력:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `JWT_SECRET` (아무 랜덤 문자열)
   - `ADMIN_PASSWORD` (관리자 비밀번호)
6. **Deploy** 클릭 → 완료!

배포 후 URL 예시: `https://church-vote-api.onrender.com`

---

## 📡 API 명세

### 투표자용 (인증 불필요)

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/sessions` | 진행 중인 투표 목록 |
| POST | `/api/verify` | 본인 확인 |
| POST | `/api/vote` | 투표 제출 |
| GET | `/api/results/:id` | 투표 결과 조회 |

### 관리자용 (JWT 토큰 필요)

| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/api/admin/login` | 관리자 로그인 |
| GET | `/api/admin/sessions` | 전체 세션 목록 |
| POST | `/api/admin/sessions` | 세션 생성 |
| PATCH | `/api/admin/sessions/:id/close` | 투표 종료 |
| DELETE | `/api/admin/sessions/:id` | 세션 삭제 |

### 요청 예시

```bash
# 관리자 로그인
curl -X POST https://your-api.onrender.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password": "1234"}'

# 세션 생성 (응답 토큰으로 Authorization 헤더 설정)
curl -X POST https://your-api.onrender.com/api/admin/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "2025년도 장로 선출",
    "role": "장로",
    "vote_type": "single",
    "max_pick": 1,
    "candidates": [
      {"name": "홍길동", "description": "청년부 담당"},
      {"name": "김철수", "description": "교육부 담당"}
    ],
    "voters": "이영희,800101\n박민수,900202"
  }'

# 본인 확인
curl -X POST https://your-api.onrender.com/api/verify \
  -H "Content-Type: application/json" \
  -d '{"session_id": "uuid", "name": "이영희", "code": "800101"}'

# 투표 제출
curl -X POST https://your-api.onrender.com/api/vote \
  -H "Content-Type: application/json" \
  -d '{"voter_id": "uuid", "session_id": "uuid", "candidate_ids": ["uuid"]}'
```

---

## 🔒 보안 주의사항

- `.env` 파일은 절대 GitHub에 올리지 마세요 (`.gitignore`에 포함됨)
- 배포 후 `CORS origin`을 프론트엔드 주소로 제한하세요
- `ADMIN_PASSWORD`는 영숫자 혼합 8자 이상 권장

---

## ⚙️ Render 슬립 방지

Render 무료 플랜은 15분 비활성 시 슬립됩니다.
투표 당일 아침에 `/health` 엔드포인트에 한 번 접속하면 깨어납니다.
또는 [UptimeRobot](https://uptimerobot.com) (무료)으로 5분마다 핑을 보내도록 설정하세요.
