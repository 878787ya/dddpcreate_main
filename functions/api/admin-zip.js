import { zipSync } from 'fflate';

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const keyParam = url.searchParams.get('key') || '';
  const orderId = url.searchParams.get('id') || '';

  // 1. 安全性檢查：金鑰必須正確
  if (!env.ADMIN_TOKEN || keyParam !== env.ADMIN_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!orderId) {
    return new Response('Missing order ID', { status: 400 });
  }

  try {
    // 2. 從 D1 資料庫撈取特定訂單的資料
    const order = await env.DB.prepare(
      `SELECT name, photo_entries FROM orders WHERE id = ?`
    ).bind(orderId).first();

    if (!order) {
      return new Response('Order Not Found', { status: 404 });
    }

    const photoEntries = JSON.parse(order.photo_entries || '[]');
    if (photoEntries.length === 0) {
      return new Response('No photos in this order', { status: 400 });
    }

    // 3. 從 R2 併發抓取所有圖片檔案
    const filePromises = photoEntries.map(entry => env.MY_BUCKET.get(entry.key));
    const r2Objects = await Promise.all(filePromises);

    // 4. 使用 fflate 建立 ZIP 檔案
    const filesToZip = {};
    for (let i = 0; i < r2Objects.length; i++) {
      const obj = r2Objects[i];
      if (obj) {
        // 使用原始檔名作為 ZIP 內的檔名
        const filename = photoEntries[i].filename || `photo-${i + 1}.jpg`;
        filesToZip[filename] = new Uint8Array(await obj.arrayBuffer());
      }
    }
    
    const zipped = zipSync(filesToZip);

    // 5. 組合 ZIP 檔案的名稱（例如：王大明-1.zip）
    const orderNumber = url.searchParams.get('n') || '_';
    const zipFilename = `${order.name}-${orderNumber}.zip`;

    // 6. 回傳 ZIP 檔案給瀏覽器
    return new Response(zipped, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(zipFilename)}"`
      }
    });

  } catch (err) {
    return new Response(`Server error: ${err.message}`, { status: 500 });
  }
};
