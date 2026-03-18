const router = require('express').Router();
const supabase = require('../supabase');

// ── GET /api/sessions ─ 진행 중인 세션 목록 ──────────
router.get('/sessions', async (req, res) => {
  const { data, error } = await supabase
    .from('sessions')
    .select(`id, title, role, vote_type, max_pick, status, created_at,
             candidates(id, name, description),
             voters(id, has_voted)`)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // 투표 현황 요약만 포함 (개인 정보 제외)
  const summary = data.map(s => ({
    ...s,
    voter_total: s.voters.length,
    voter_voted: s.voters.filter(v => v.has_voted).length,
    voters: undefined // 명부 원본 숨김
  }));

  res.json(summary);
});

// ── POST /api/verify ─ 투표자 본인 확인 ──────────────
router.post('/verify', async (req, res) => {
  const { session_id, name, code } = req.body;
  if (!session_id || !name || !code) {
    return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
  }

  // 세션 유효 확인
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', session_id)
    .single();

  if (!session) return res.status(404).json({ error: '존재하지 않는 세션입니다.' });
  if (session.status !== 'active') return res.status(400).json({ error: '종료된 투표입니다.' });

  // 투표자 확인
  const { data: voter } = await supabase
    .from('voters')
    .select('id, has_voted')
    .eq('session_id', session_id)
    .eq('name', name.trim())
    .eq('code', code.trim())
    .single();

  if (!voter) return res.status(404).json({ error: '투표자 명부에 등록되지 않은 정보입니다.' });
  if (voter.has_voted) return res.status(409).json({ error: '이미 투표에 참여하셨습니다.' });

  res.json({ voter_id: voter.id, message: '확인되었습니다.' });
});

// ── POST /api/vote ─ 투표 제출 ────────────────────────
router.post('/vote', async (req, res) => {
  const { voter_id, session_id, candidate_ids } = req.body;

  if (!voter_id || !session_id || !candidate_ids?.length) {
    return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
  }

  // 1) 세션 + 투표자 재확인 (이중 방지)
  const { data: voter } = await supabase
    .from('voters')
    .select('id, has_voted, session_id')
    .eq('id', voter_id)
    .single();

  if (!voter || voter.session_id !== session_id) {
    return res.status(403).json({ error: '유효하지 않은 투표자입니다.' });
  }
  if (voter.has_voted) {
    return res.status(409).json({ error: '이미 투표에 참여하셨습니다.' });
  }

  // 2) 세션 설정 확인 (max_pick 초과 방지)
  const { data: session } = await supabase
    .from('sessions')
    .select('status, max_pick')
    .eq('id', session_id)
    .single();

  if (!session || session.status !== 'active') {
    return res.status(400).json({ error: '투표할 수 없는 세션입니다.' });
  }
  if (candidate_ids.length > session.max_pick) {
    return res.status(400).json({ error: `최대 ${session.max_pick}명까지 선택할 수 있습니다.` });
  }

  // 3) 득표수 증가 (각 후보자)
  for (const cid of candidate_ids) {
    const { error } = await supabase.rpc('increment_vote', { candidate_id: cid, session_id });
    if (error) return res.status(500).json({ error: error.message });
  }

  // 4) 투표자 완료 처리
  await supabase
    .from('voters')
    .update({ has_voted: true, voted_at: new Date().toISOString() })
    .eq('id', voter_id);

  res.json({ message: '투표가 완료되었습니다.' });
});

// ── GET /api/results/:id ─ 투표 결과 ─────────────────
router.get('/results/:id', async (req, res) => {
  const { id } = req.params;

  const { data: session, error: sErr } = await supabase
    .from('sessions')
    .select('id, title, role, vote_type, status')
    .eq('id', id)
    .single();

  if (sErr || !session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

  const { data: candidates } = await supabase
    .from('candidates')
    .select('id, name, description, vote_count')
    .eq('session_id', id)
    .order('vote_count', { ascending: false });

  const { data: voterStats } = await supabase
    .from('voters')
    .select('has_voted')
    .eq('session_id', id);

  const total = voterStats?.length || 0;
  const voted = voterStats?.filter(v => v.has_voted).length || 0;

  res.json({
    session,
    candidates,
    stats: { total, voted, rate: total > 0 ? Math.round(voted / total * 100) : 0 }
  });
});

module.exports = router;
