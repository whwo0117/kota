// POST /api/submit  { cid: string, answers: [6 integers 1..5] }
// Stores one survey response in Supabase. No login needed.
// `cid` is a random id created per page load: it only makes retries/double-clicks idempotent
// (the same visit can never be counted twice). Different visitors always get different ids.
function cfg() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, key };
}
// legacy JWT keys (eyJ...) need apikey + Authorization; new keys (sb_secret_...) only the apikey header
function hdr(key, extra) {
  const h = Object.assign({ apikey: key, 'Content-Type': 'application/json' }, extra || {});
  if (!key.startsWith('sb_')) h.Authorization = 'Bearer ' + key;
  return h;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  const { url, key } = cfg();
  if (!url || !key) return res.status(500).json({ ok: false, error: 'server_not_configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const cid = body && typeof body.cid === 'string' ? body.cid : '';
  const answers = body && body.answers;
  const valid =
    /^[A-Za-z0-9-]{16,64}$/.test(cid) &&
    Array.isArray(answers) && answers.length === 6 &&
    answers.every((v) => Number.isInteger(v) && v >= 1 && v <= 5);
  if (!valid) return res.status(400).json({ ok: false, error: 'invalid_payload' });

  try {
    const r = await fetch(`${url}/rest/v1/responses?on_conflict=client_id`, {
      method: 'POST',
      headers: hdr(key, { Prefer: 'resolution=ignore-duplicates,return=representation' }),
      body: JSON.stringify({ client_id: cid, answers }),
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: 'database_error_' + r.status });
    const rows = await r.json();
    // rows is empty when this cid was already stored -> not counted twice
    return res.status(200).json({ ok: true, duplicate: Array.isArray(rows) && rows.length === 0 });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'database_unreachable' });
  }
};
