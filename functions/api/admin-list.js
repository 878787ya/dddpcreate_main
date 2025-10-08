export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

  if (!env.ADMIN_TOKEN || key !== env.ADMIN_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const rs = await env.DB.prepare(
    `SELECT id, name, email, occasion, style, recipient, photo_count, photo_entries, created_at
     FROM orders
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(limit).all();

  const rows = rs.results || [];
  const html = renderHTML(rows, key);
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};

function renderHTML(rows, key) {
  const items = rows.map((r) => {
    const photos = safeParseJSON(r.photo_entries, []);
    const thumbs = photos.map((p) => {
      const src = `/api/admin-file?k=${encodeURIComponent(p.key)}&key=${encodeURIComponent(key)}`;
      const cap = escapeHtml(p.caption || '');
      return `<figure><img src="${src}" loading="lazy"><figcaption>${cap}</figcaption></figure>`;
    }).join('');

    return `
    <article class="card">
      <header>
        <div class="title">#${r.id}</div>
        <div class="meta">${escapeHtml(r.name)} · ${escapeHtml(r.email)} · ${escapeHtml(r.created_at)}</div>
      </header>
      <div class="grid">
        <div><b>Occasion</b><div>${escapeHtml(r.occasion)}</div></div>
        <div><b>Style</b><div>${escapeHtml(r.style)}</div></div>
        <div><b>Recipient</b><div>${escapeHtml(r.recipient)}</div></div>
        <div><b>Photos</b><div>${r.photo_count}</div></div>
      </div>
      <section class="photos">${thumbs}</section>
    </article>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>訂單清單</title>
<style>
  :root{--fg:#111;--muted:#666;--bd:#e5e7eb;--bg:#fafafa}
  body{font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;max-width:1100px;margin:24px auto;padding:0 16px;color:var(--fg);background:#fff}
  h1{margin:0 0 16px}
  .card{border:1px solid var(--bd);border-radius:14px;padding:16px;margin:16px 0;background:#fff}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:8px 0 12px}
  .photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
  figure{margin:0;border:1px solid var(--bd);border-radius:10px;padding:8px;background:var(--bg)}
  img{max-width:100%;height:140px;object-fit:cover;border-radius:6px;display:block}
  figcaption{font-size:12px;color:var(--muted);margin-top:6px;white-space:pre-wrap}
  header .title{font-weight:700}
  header .meta{font-size:12px;color:var(--muted)}
  .topbar{display:flex;justify-content:space-between;align-items:center}
  .muted{color:var(--muted)}
  @media (max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
  <div class="topbar">
    <h1>訂單清單</h1>
    <div class="muted">僅供內部檢視 · limit=${rows.length}</div>
  </div>
  ${items || '<p class="muted">目前沒有資料</p>'}
</body>
</html>`;
}

function safeParseJSON(s, d){ try{return JSON.parse(s);}catch{ return d; } }
function escapeHtml(s){ return s.replace(/[&<>"']/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
