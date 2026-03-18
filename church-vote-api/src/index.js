require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const adminRoutes = require('./routes/admin');
const voteRoutes  = require('./routes/vote');

const app = express();

// ── 미들웨어 ────────────────────────────────────────
app.use(cors({ origin: '*' })); // 배포 후 프론트 도메인으로 제한 권장
app.use(express.json());

// 투표 API 요청 제한 (IP당 1분에 30회)
const limiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true });
app.use('/api', limiter);

// ── 라우트 ──────────────────────────────────────────
app.use('/api/admin', adminRoutes);
app.use('/api',       voteRoutes);

// ── 헬스 체크 (Render 슬립 방지용) ─────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── 404 ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: '요청한 경로를 찾을 수 없습니다.' });
});

// ── 서버 시작 ────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 교회 투표 서버 실행 중 → http://localhost:${PORT}`);
});
