'use strict';

// Güvenlik sınırı: Harici AI web sitelerini barındıran WebContentsView örneklerine
// yalnızca anti-bot gizleme uygulanır. Hiçbir IPC veya Node.js API'si açılmaz.
try {
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
    configurable: true,
  });
} catch {
  // Bazı sayfalarda salt-okunur olabilir; sessizce geçilir.
}
