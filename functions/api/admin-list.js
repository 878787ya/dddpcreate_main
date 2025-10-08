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

// --- Helper Functions ---
function getColorForName(name) {
  const colors = [
    '#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab',
    '#1e88e5', '#039be5', '#00acc1', '#00897b', '#43a047',
    '#7cb342', '#c0ca33', '#fdd835', '#ffb300', '#fb8c00',
    '#f4511e', '#6d4c41', '#757575', '#546e7a'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash % colors.length)];
}

function safeParseJSON(s, d){ try{return JSON.parse(s);}catch{ return d; } }
function escapeHtml(s){ return s ? s.replace(/[&<>"']/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])) : ''; }

// --- HTML Rendering ---
function renderHTML(rows, key) {
  const items = rows.map((r, index) => {
    const photos = safeParseJSON(r.photo_entries, []);
    const orderNumber = index + 1;
    const nameColor = getColorForName(r.name);

    const thumbs = photos.map((p) => {
      const imgSrc = `/api/admin-file?k=${encodeURIComponent(p.key)}&key=${encodeURIComponent(key)}`;
      // 新增：為單張圖片加上下載連結，並附帶 download 屬性
      const downloadHref = `${imgSrc}&download=1&filename=${encodeURIComponent(p.filename)}`;
      const cap = escapeHtml(p.caption || '');
      return `<figure>
        <img src="${imgSrc}" loading="lazy" alt="${cap}">
        <figcaption>${cap}</figcaption>
        <a href="${downloadHref}" class="single-download" download>下載</a>
      </figure>`;
    }).join('');

    return `
    <article class="card">
      <div class="details">
        <header class="card-header">
          <div class="order-number">#${orderNumber}</div>
          <div class="main-info">
            <strong style="color: ${nameColor};">${escapeHtml(r.name)}</strong>
            <span>送給</span>
            <strong>${escapeHtml(r.recipient)}</strong>
          </div>
        </header>
        <div class="meta-grid">
          <div><label>訂單編號</label><span>${r.id}</span></div>
          <div><label>Email</label><span>${escapeHtml(r.email)}</span></div>
          <div><label>送禮場合</label><span>${escapeHtml(r.occasion)}</span></div>
          <div><label>卡片風格</label><span>${escapeHtml(r.style)}</span></div>
          <div><label>照片數量</label><span>${r.photo_count} 張</span></div>
          <div><label>訂購時間</label><span>${escapeHtml(r.created_at)}</span></div>
        </div>
      </div>
      <section class="photos">${thumbs || '<p class="no-photos">此訂單沒有照片</p>'}</section>
    </article>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>訂單清單</title>
<style>
  :root { --fg: #212529; --muted: #6c757d; --border: #dee2e6; --bg: #f8f9fa; --accent: #007bff; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif; max-width: 1200px; margin: 2rem auto; padding: 0 1rem; color: var(--fg); background-color: #fff; }
  h1 { margin: 0 0 1rem; }
  .topbar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
  .muted { color: var(--muted); font-size: 0.9rem; }
  .card { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 16px; margin: 1.5rem 0; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden; }
  .details { padding: 1.5rem; }
  .card-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
  .order-number { font-size: 1rem; font-weight: 700; background-color: var(--bg); color: var(--muted); padding: 0.25rem 0.75rem; border-radius: 2rem; }
  .main-info { font-size: 1.25rem; flex-grow: 1; }
  .main-info span { font-size: 1rem; color: var(--muted); margin: 0 0.25rem; }
  .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
  .meta-grid > div { display: flex; flex-direction: column; }
  .meta-grid label { font-size: 0.8rem; color: var(--muted); margin-bottom: 0.25rem; }
  .meta-grid span { font-weight: 500; word-break: break-all; }
  .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; background-color: var(--bg); padding: 1.5rem; border-top: 1px solid var(--border); }
  .no-photos { color: var(--muted); }
  figure { margin: 0; border: 1px solid var(--border); border-radius: 12px; padding: 0.75rem; background: #fff; position: relative; }
  img { width: 100%; height: 160px; object-fit: cover; border-radius: 8px; display: block; }
  figcaption { font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem; white-space: pre-wrap; word-break: break-word; }
  .single-download { position: absolute; top: 1.25rem; right: 1.25rem; background-color: rgba(0,0,0,0.5); color: white; text-decoration: none; font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 4px; transition: background-color 0.2s; }
  .single-download:hover { background-color: rgba(0,0,0,0.8); }
  @media (max-width: 768px) { body { margin: 1rem auto; } .topbar, .card-header { flex-direction: column; align-items: flex-start; gap: 0.75rem; } }
</style>
</head><body><div class="topbar"><h1>訂單清單</h1><div class="muted">僅供內部檢視 · 最近 ${rows.length} 筆訂單</div></div>
${items || '<p class="muted">目前沒有資料</p>'}
</body></html>`;
}
