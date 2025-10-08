// /functions/api/upload.js

export const onRequestPost = async ({ request, env }) => {
  try {
    const form = await request.formData();

    // 必填欄位（和你的前端 name 對應）
    const name = getStr(form, 'name');
    const email = getStr(form, 'email');
    const style = getStr(form, 'style');
    const recipient = getStr(form, 'recipient');
    const mainText = getStr(form, 'main_text');
    const occasion = getStr(form, 'occasion');

    if (!name || !email || !style || !recipient || !mainText || !occasion) {
      return json({ error: '缺少必要欄位' }, 400);
    }

    // 選填
    const phone = getStr(form, 'phone') || null;
    const dueDate = getStr(form, 'due_date') || null;
    const notes = getStr(form, 'notes') || null;
    const consentPortfolio = form.get('consent_portfolio') ? 1 : 0;
    const photoCount = parseInt(getStr(form, 'photo_count') || '0', 10);

    // 多張照片與註解（前端用 name="photos[]" 和 name="captions[]"）
    const files = form.getAll('photos[]').filter(Boolean);
    const captions = form.getAll('captions[]').map(v => (v ?? '').toString());
    const entries = [];

    // 後端安全限制（大小/類型）
    const ALLOW = ['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'];
    const MAX_MB = 10;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (typeof file?.stream !== 'function') continue;
      if (!ALLOW.includes(file.type)) return json({ error:`不支援的檔案類型：${file.type}` }, 400);
      if (file.size > MAX_MB*1024*1024) return json({ error:`單檔不可超過 ${MAX_MB}MB：${file.name}` }, 400);

      const key = makeKey(file.name);
      await env.MY_BUCKET.put(key, file.stream(), { httpMetadata:{ contentType:file.type } });

      entries.push({
        key,                         // 存到 R2 的路徑
        filename: file.name,
        size: file.size,
        type: file.type,
        caption: captions[i] ?? ''   // 對應的註解
      });
    }

    // 如果想嚴格要求「選幾張就一定要上傳幾張」，可以改成直接丟 400
    if (photoCount && entries.length !== photoCount) {
      // return json({ error:`預期 ${photoCount} 張，但收到 ${entries.length} 張` }, 400);
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

  
    await env.DB.prepare(
      `INSERT INTO orders
       (id, name, email, phone, occasion, style, recipient, main_text,
        due_date, notes, consent_portfolio, photo_count, photo_entries, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, name, email, phone, occasion, style, recipient, mainText,
      dueDate, notes, consentPortfolio, entries.length, JSON.stringify(entries), createdAt
    ).run();


    return json({ ok:true, id, stored: entries.length }, 200);

  } catch (err) {
    return json({ error: err.message || 'Server error' }, 500);
  }
};

function json(data, status=200){
  return new Response(JSON.stringify(data), {
    status,
    headers:{ 'content-type':'application/json; charset=utf-8' }
  });
}
function getStr(form, key){ return (form.get(key) || '').toString().trim(); }
function makeKey(filename='file'){
  const clean = filename.replace(/[^\w.\-]+/g, '_');
  const ymd = new Date().toISOString().slice(0,10);
  return `uploads/${ymd}/${crypto.randomUUID()}-${clean}`;
}



