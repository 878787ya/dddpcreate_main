export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const keyParam = url.searchParams.get('key') || '';
  const objectKey = url.searchParams.get('k') || '';

  if (!env.ADMIN_TOKEN || keyParam !== env.ADMIN_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!objectKey) return new Response('Missing k', { status: 400 });

  const obj = await env.MY_BUCKET.get(objectKey);
  if (!obj) return new Response('Not Found', { status: 404 });

  const headers = new Headers();
  const ct = obj.httpMetadata?.contentType || 'application/octet-stream';
  headers.set('content-type', ct);

  // 【新增的邏輯】
  // 如果 URL 參數中帶有 "download=1"，就設定為附件下載
  if (url.searchParams.get('download')) {
    const filename = url.searchParams.get('filename') || objectKey.split('/').pop();
    headers.set('content-disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  }

  return new Response(obj.body, { headers });
};
