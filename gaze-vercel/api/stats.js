// GET /api/stats -> { n, a, b }
// n = number of stored responses
// a = answers "보통이다/그렇다/매우 그렇다" (>=3) among Q1-3 (total possible = 3*n)
// b = answers "전혀/그렇지 않다/보통이다" (<=3) among Q4-6 (total possible = 3*n)
function cfg() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, key };
}
function hdr(key, extra) {
  const h = Object.assign({ apikey: key, 'Content-Type': 'application/json' }, extra || {});
  if (!key.startsWith('sb_')) h.Authorization = 'Bearer ' + key;
  return h;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { url, key } = cfg();
  if (!url || !key) return res.status(500).json({ error: 'server_not_configured' });
  try {
    const r = await fetch(`${url}/rest/v1/rpc/gaze_stats`, { method: 'POST', headers: hdr(key), body: '{}' });
    if (!r.ok) return res.status(502).json({ error: 'database_error_' + r.status });
    const j = await r.json();
    return res.status(200).json({ n: Number(j.n) || 0, a: Number(j.a) || 0, b: Number(j.b) || 0 });
  } catch (e) {
    return res.status(502).json({ error: 'database_unreachable' });
  }
};
