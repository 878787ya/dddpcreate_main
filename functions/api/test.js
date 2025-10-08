// /functions/api/test.js
export const onRequestGet = async ({ env }) => {
  const hasR2 = !!env.MY_BUCKET;
  const hasD1 = !!env.DB;
  return new Response(JSON.stringify({ ok: hasR2 && hasD1, r2: hasR2, d1: hasD1 }), {
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
};
