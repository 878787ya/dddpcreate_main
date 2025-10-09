// /functions/api/admin-list.js

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

  if (!env.ADMIN_TOKEN || key !== env.ADMIN_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // --- 【修改點 1】更新 SQL 查詢，加入所有缺少的欄位 ---
  const rs = await env.DB.prepare(
    `SELECT 
       id, name, email, phone, occasion, style, recipient, main_text,
       due_date, notes, consent_portfolio, photo_count, photo_entries, created_at
     FROM orders
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(limit).all();

  const rows = rs.results || [];
  const html = renderHTML(rows, key);
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};


// --- Helper Functions (輔助函式) ---
function safeParseJSON(s, d){ try{return JSON.parse(s);}catch{ return d; } }
function escapeHtml(s){ return s ? s.replace(/[&<>"']/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])) : ''; }


// --- HTML Rendering (渲染 HTML) ---
function renderHTML(rows, key) {
  const items = rows.map((r) => {
    const photos = safeParseJSON(r.photo_entries, []);
    
    // --- 【修改點 2】產生圖片預覽和下載按鈕的 HTML ---
    const thumbs = photos.map((p) => {
      // 圖片預覽路徑
      const imgSrc = `/api/admin-file?k=${encodeURIComponent(p.key)}&key=${encodeURIComponent(key)}`;
      // 圖片下載路徑，加上 download=1 和原始檔名
      const downloadHref = `${imgSrc}&download=1&filename=${encodeURIComponent(p.filename)}`;
      const caption = escapeHtml(p.caption || '');

      return `<figure>
        <img src="${imgSrc}" loading="lazy" alt="${caption}">
        <figcaption>${caption || '<i>(無註解)</i>'}</figcaption>
        <a href="${downloadHref}" class="download-btn" title="下載此圖片" download>↓</a>
      </figure>`;
    }).join('');

    // --- 【修改點 3】重新設計訂單卡片的 HTML 結構，並補上所有欄位 ---
    return `
    <article class="card">
      <header class="card-header">
        <div class="main-info">
          <strong>${escapeHtml(r.name)}</strong>
          <span class="muted-text">( ${escapeHtml(r.email)} )</span>
          <span>送給</span>
          <strong>${escapeHtml(r.recipient)}</strong>
        </div>
        <div class="order-meta">
          <span class="order-id">ID: ${r.id}</span>
          <span>${escapeHtml(r.created_at)}</span>
        </div>
      </header>
      
      <div class="card-body">
        <div class="info-grid">
          <div><label>送禮場合</label><span>${escapeHtml(r.occasion)}</span></div>
          <div><label>卡片風格</label><span>${escapeHtml(r.style)}</span></div>
          <div><label>聯絡電話</label><span>${escapeHtml(r.phone) || '<i>(未提供)</i>'}</span></div>
          <div><label>希望完成日</label><span>${escapeHtml(r.due_date) || '<i>(未指定)</i>'}</span></div>
        </div>

        <div class="text-content">
          <label>主祝福文字</label>
          <p>${escapeHtml(r.main_text)}</p>
        </div>

        <div class="text-content">
          <label>其他備註</label>
          <p>${escapeHtml(r.notes) || '<i>(無)</i>'}</p>
        </div>
        
        <div class="consent-info">
          <label>同意作為作品集：</label>
          <span>${r.consent_portfolio ? '✅ 同意' : '❌ 未同意'}</span>
        </div>
      </div>
      
      <footer class="card-footer">
        <div class="footer-title">
          客戶照片 (${r.photo_count} 張)
        </div>
        <div class="photos">${thumbs || '<p class="muted-text">此訂單沒有照片</p>'}</div>
      </footer>
    </article>`;
  }).join('');

  // --- 【修改點 4】更新整頁的 HTML 骨架和 CSS 樣式 ---
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>訂單清單</title>
  <style>
    :root { --fg: #212529; --muted: #6c757d; --border: #dee2e6; --bg-soft: #f8f9fa; --bg-white: #fff; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: var(--fg); background-color: #f1f3f5; }
    h1 { margin: 0 0 1rem; }
    .topbar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1rem; }
    .muted-text { color: var(--muted); font-size: 0.9rem; }
    .card { border: 1px solid var(--border); border-radius: 12px; margin: 1.5rem 0; background: var(--bg-white); box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden; }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1.25rem; background-color: var(--bg-soft); border-bottom: 1px solid var(--border); }
    .main-info { font-size: 1.1rem; }
    .main-info span { font-size: 0.9rem; margin: 0 0.25rem; }
    .order-meta { text-align: right; font-size: 0.8rem; color: var(--muted); flex-shrink: 0; }
    .order-id { font-family: monospace; display: block; }
    .card-body { padding: 1.25rem; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
    .info-grid > div { display: flex; flex-direction: column; }
    .info-grid label, .text-content label, .consent-info label { font-size: 0.8rem; color: var(--muted); margin-bottom: 0.25rem; font-weight: 500; }
    .info-grid span, .consent-info span { font-weight: 500; word-break: break-all; }
    .text-content { margin-bottom: 1.5rem; }
    .text-content p { margin: 0; white-space: pre-wrap; word-break: break-word; border: 1px solid var(--border); padding: 0.75rem; border-radius: 6px; background-color: var(--bg-soft); }
    .card-footer { padding: 1.25rem; background-color: #fcfdff; border-top: 1px solid #e9ecef; }
    .footer-title { font-weight: bold; margin-bottom: 1rem; }
    .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; }
    figure { position: relative; margin: 0; border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem; background: var(--bg-white); }
    img { width: 100%; height: 120px; object-fit: cover; border-radius: 6px; display: block; }
    figcaption { font-size: 0.75rem; color: var(--muted); margin-top: 0.5rem; white-space: pre-wrap; word-break: break-word; }
    .download-btn { position: absolute; top: 1rem; right: 1rem; width: 24px; height: 24px; background-color: rgba(0,0,0,0.6); color: white; text-decoration: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; transition: background-color 0.2s; }
    .download-btn:hover { background-color: rgba(0,0,0,0.9); }
    @media (max-width: 600px) { .card-header { flex-direction: column; align-items: flex-start; } .info-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>訂單清單</h1>
    <div class="muted-text">最近 ${rows.length} 筆訂單</div>
  </div>
  ${items || '<p class="muted-text" style="padding: 2rem 0;">目前沒有訂單資料</p>'}
</body>
</html>`;
}
