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
  // 如需下載，可加：headers.set('content-disposition', `attachment; filename="${objectKey.split('/').pop()}"`);

  return new Response(obj.body, { headers });
};
