// /functions/api/admin-file.js

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const keyParam = url.searchParams.get('key') || '';
  const objectKey = url.searchParams.get('k') || '';

  // --- 安全性檢查 ---
  if (!env.ADMIN_TOKEN || keyParam !== env.ADMIN_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!objectKey) {
    return new Response('Missing object key', { status: 400 });
  }

  // --- 從 R2 取得檔案 ---
  const obj = await env.MY_BUCKET.get(objectKey);
  if (!obj) {
    return new Response('Object Not Found', { status: 404 });
  }

  // --- 設定回傳標頭 ---
  const headers = new Headers();
  const contentType = obj.httpMetadata?.contentType || 'application/octet-stream';
  headers.set('Content-Type', contentType);

  // --- 【修改點】新增下載邏輯 ---
  // 檢查 URL 是否有 ?download=1 參數
  const isDownload = url.searchParams.get('download') === '1';
  // 檢查 URL 是否有傳遞原始檔案名稱
  const filename = url.searchParams.get('filename') || objectKey.split('/').pop();

  if (isDownload) {
    // 如果是下載請求，則附加 Content-Disposition 標頭
    // 這會告訴瀏覽器要下載檔案，而不是在頁面上顯示它
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  }
  
  return new Response(obj.body, { headers });
};
