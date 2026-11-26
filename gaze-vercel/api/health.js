// GET /api/health  -> tells you exactly what is wrong with the setup (never shows secrets).
// Open https://YOUR-SITE.vercel.app/api/health in a browser. You can delete this file after launch.
function cfg() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, key };
}
function hdr(key) {
  const h = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_')) h.Authorization = 'Bearer ' + key;
  return h;
}
function keyType(key) {
  if (!key) return null;
  if (key.startsWith('sb_secret_')) return 'secret (new format) - OK';
  if (key.startsWith('sb_publishable_')) return 'PUBLISHABLE key - WRONG, use the secret / service_role key';
  if (key.startsWith('eyJ')) {
    try {
      const role = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString()).role;
      return role === 'service_role' ? 'legacy service_role - OK' : `legacy "${role}" key - WRONG, use service_role`;
    } catch (e) { return 'legacy jwt (could not read role)'; }
  }
  return 'unknown format';
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { url, key } = cfg();
  let host = null;
  if (url) { try { host = new URL(url).host; } catch (e) { host = 'INVALID_URL (must look like https://xxxx.supabase.co)'; } }
  const out = { SUPABASE_URL_set: !!url, SUPABASE_SERVICE_ROLE_KEY_set: !!key, url_host: host, key_type: keyType(key) };
  if (!url || !key) { out.status = 'env_missing: add the 2 environment variables in Vercel, then Redeploy'; return res.status(200).json(out); }
  try {
    const t = await fetch(`${url}/rest/v1/responses?select=id&limit=1`, { headers: hdr(key) });
    out.table_http = t.status;
    if (!t.ok) out.table_detail = (await t.text()).slice(0, 300);
    const f = await fetch(`${url}/rest/v1/rpc/gaze_stats`, { method: 'POST', headers: hdr(key), body: '{}' });
    out.function_http = f.status;
    const txt = await f.text();
    if (f.ok) { out.stats = JSON.parse(txt); if (out.stats.v !== 2) out.function_detail = 'OUTDATED: run the latest supabase.sql again'; } else out.function_detail = txt.slice(0, 300);
    out.status = t.ok && f.ok && !out.function_detail ? 'ok' : 'problem: see table_detail / function_detail';
  } catch (e) {
    out.status = 'cannot reach Supabase: check SUPABASE_URL';
    out.detail = String((e && e.message) || e);
  }
  return res.status(200).json(out);
};
