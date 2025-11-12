// Service Worker無効化 - 開発中は完全にキャッシュしない
self.addEventListener('install', function(event) {
  // 即座にアクティブ化
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    // 全てのキャッシュを削除
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// fetch イベントでは何もしない - 全てブラウザのデフォルト処理に任せる
self.addEventListener('fetch', function(event) {
  // 何もしない - キャッシュを完全に無効化
});