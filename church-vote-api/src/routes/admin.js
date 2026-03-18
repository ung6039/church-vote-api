const router = require('express').Router();
const jwt = require('jsonwebtoken');
const supabase = require('../supabase');
const adminAuth = require('../middleware/adminAuth');

// ── POST /api/admin/login ──────────────────────────────
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  }
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// ── POST /api/admin/sessions ─ 세션 생성 ──────────────
router.post('/sessions', adminAuth, async (req, res) => {
  const { title, role, vote_type, max_pick, candidates, voters } = req.body;

  if (!title || !role || !vote_type) {
    return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
  }
  if (vote_type !== 'yesno' && (!candidates || candidates.length < 2)) {
    return res.status(400).json({ error: '후보자를 2명 이상 입력하세요.' });
  }
  if (!voters || voters.length === 0) {
    return res.status(400).json({ error: '투표자 명부를 입력하세요.' });
  }

  // 1) 세션 생성
  const { data: session, error: sErr } = await supabase
    .from('sessions')
    .insert({ title, role, vote_type, max_pick: max_pick || 1 })
    .select()
    .single();

  if (sErr) return res.status(500).json({ error: sErr.message });

  // 2) 후보자 삽입 (yesno는 트리거로 자동 생성)
  if (vote_type !== 'yesno') {
    const candidateRows = candidates.map(c => ({
      session_id: session.id,
      name: c.name,
      description: c.description || ''
    }));
    const { error: cErr } = await supabase.from('candidates').insert(candidateRows);
    if (cErr) return res.status(500).json({ error: cErr.message });
  }

  // 3) 투표자 명부 삽입
  // voters 형식: [{ name, code }] 또는 "홍길동,800101\n..." 문자열
  let voterRows = [];
  if (typeof voters === 'string') {
    voterRows = voters.trim().split('\n').map(line => {
      const [name, code] = line.split(',');
      return { session_id: session.id, name: name?.trim(), code: code?.trim() };
    }).filter(v => v.name && v.code);
  } else {
    voterRows = voters.map(v => ({ session_id: session.id, name: v.name, code: v.code }));
  }

  const { error: vErr } = await supabase.from('voters').insert(voterRows);
  if (vErr) return res.status(500).json({ error: vErr.message });

  res.status(201).json({ message: '세션이 생성되었습니다.', session });
});

// ── PATCH /api/admin/sessions/:id/close ─ 세션 종료 ──
router.patch('/sessions/:id/close', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'closed' })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: '투표가 종료되었습니다.' });
});

// ── DELETE /api/admin/sessions/:id ─ 세션 삭제 ────────
router.delete('/sessions/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('sessions').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: '세션이 삭제되었습니다.' });
});

// ── GET /api/admin/sessions ─ 전체 세션 목록 ──────────
router.get('/sessions', adminAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('sessions')
    .select(`*, candidates(*), voters(id, has_voted)`)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
