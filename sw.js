// ============================================================
// 恋愛運ホロスコープカレンダー Service Worker
// ============================================================

const CACHE_NAME = 'lovefortune-v1';

// キャッシュするファイル一覧
const CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── インストール：キャッシュを作成 ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_FILES).catch(err => {
        // アイコンなど一部のファイルがなくてもインストールを続行
        console.warn('SW: キャッシュに失敗したファイルがあります:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── アクティベート：古いキャッシュを削除 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── フェッチ：キャッシュ優先、なければネットワーク ──
self.addEventListener('fetch', event => {
  // 外部CDN（astronomy-engine / Google Fonts / 楽天）はキャッシュしない
  const url = event.request.url;
  if (
    url.includes('cdn.jsdelivr.net') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('rakuten.co.jp') ||
    url.includes('affiliate.rakuten')
  ) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // 正常なレスポンスだけキャッシュに追加
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // オフライン時にHTMLリクエストならキャッシュ済みのルートを返す
      if (event.request.destination === 'document') {
        return caches.match('./');
      }
    })
  );
});

// ── プッシュ通知受信 ──
self.addEventListener('push', event => {
  let data = { title: '♀ 恋愛運ホロスコープ', body: '今日の恋愛運をチェックしましょう 💕' };
  try {
    if (event.data) data = event.data.json();
  } catch(e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    './icon-192.png',
      badge:   './icon-192.png',
      tag:     'lovefortune-daily',
      vibrate: [200, 100, 200],
      data:    { url: data.url || 'https://11th-principality.github.io/lovefortune/' },
    })
  );
});

// ── 通知クリック：アプリを開く ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : 'https://11th-principality.github.io/lovefortune/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // すでに開いているタブがあればそちらにフォーカス
      for (const client of clientList) {
        if (client.url.includes('lovefortune') && 'focus' in client) {
          return client.focus();
        }
      }
      // なければ新しいタブで開く
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
