'use strict';

// WebContentsView bağlamında çalıştırılan DOM köprüsü yardımcı betiği.
// Tüm fonksiyonlar main.js tarafından webContents.executeJavaScript() ile çağrılmak üzere
// string olarak üretilir veya tekil ifadeler halinde çalıştırılır.

function buildFocusInputScript(inputSelectors) {
  return `(() => {
    const selectors = ${JSON.stringify(inputSelectors || [])};
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    let target = null;
    for (const sel of selectors) {
      try {
        const candidates = Array.from(document.querySelectorAll(sel));
        target = candidates.find(isVisible);
        if (target) break;
      } catch {}
    }
    if (!target) {
      return { ok: false, reason: 'Giriş kutusu seçicisi sayfada bulunamadı.' };
    }
    target.focus();
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      target.value = '';
      target.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (target.isContentEditable) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      sel.removeAllRanges();
      sel.addRange(range);
      target.innerHTML = '';
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }
    return { ok: true, tagName: target.tagName };
  })()`;
}

function buildClickSendScript(sendSelectors, inputSelectors) {
  return `(() => {
    const sendSelectors = ${JSON.stringify(sendSelectors || [])};
    const inputSelectors = ${JSON.stringify(inputSelectors || [])};
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const isEnabled = (el) => {
      if (!el) return false;
      if (el.disabled) return false;
      if (el.getAttribute('aria-disabled') === 'true') return false;
      return true;
    };

    for (const sel of sendSelectors) {
      try {
        const candidates = Array.from(document.querySelectorAll(sel));
        const btn = candidates.find((el) => isVisible(el) && isEnabled(el));
        if (btn) {
          btn.click();
          return { ok: true, method: 'button-click', selector: sel };
        }
      } catch {}
    }

    // Yedek yöntem: aktif giriş kutusuna Enter gönder
    for (const sel of inputSelectors) {
      try {
        const input = Array.from(document.querySelectorAll(sel)).find(isVisible);
        if (input) {
          input.focus();
          const evtInit = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
          input.dispatchEvent(new KeyboardEvent('keydown', evtInit));
          input.dispatchEvent(new KeyboardEvent('keypress', evtInit));
          input.dispatchEvent(new KeyboardEvent('keyup', evtInit));
          return { ok: true, method: 'enter-fallback', selector: sel };
        }
      } catch {}
    }

    return { ok: false, reason: 'Gönder butonu aktif değil veya bulunamadı.' };
  })()`;
}

function buildCheckStatusScript(config) {
  return `(() => {
    const cfg = ${JSON.stringify(config || {})};
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const isEnabled = (el) => {
      if (!el) return false;
      if (el.disabled) return false;
      if (el.getAttribute('aria-disabled') === 'true') return false;
      return true;
    };

    // Auth / Cloudflare duvarı kontrolü
    const href = window.location.href || '';
    const bodyText = (document.body && document.body.innerText ? document.body.innerText.slice(0, 600) : '');
    const authWall = (cfg.authWallIndicators || []).some((marker) =>
      href.includes(marker) || bodyText.includes(marker)
    );

    // 1. Durum: Stop butonu hala görünür mü?
    let stopVisible = false;
    for (const sel of cfg.stopButtonSelectors || []) {
      try {
        if (Array.from(document.querySelectorAll(sel)).some(isVisible)) {
          stopVisible = true;
          break;
        }
      } catch {}
    }

    // 2. Durum: Send butonu görünür ve aktif mi?
    let sendReady = false;
    for (const sel of cfg.sendButtonSelectors || []) {
      try {
        if (Array.from(document.querySelectorAll(sel)).some((el) => isVisible(el) && isEnabled(el))) {
          sendReady = true;
          break;
        }
      } catch {}
    }

    // 3. Durum: Son yanıt balonunun metin uzunluğu
    let responseCount = 0;
    let latestTextLength = 0;
    for (const sel of cfg.responseBubbleSelectors || []) {
      try {
        const nodes = Array.from(document.querySelectorAll(sel)).filter(isVisible);
        if (nodes.length > 0) {
          responseCount = nodes.length;
          const last = nodes[nodes.length - 1];
          latestTextLength = (last.innerText || last.textContent || '').trim().length;
          break;
        }
      } catch {}
    }

    return {
      authWall,
      href,
      stopVisible,
      sendReady,
      responseCount,
      latestTextLength
    };
  })()`;
}

function buildExtractResponseScript(responseSelectors) {
  return `(() => {
    const selectors = ${JSON.stringify(responseSelectors || [])};
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    let nodes = [];
    for (const sel of selectors) {
      try {
        const found = Array.from(document.querySelectorAll(sel)).filter(isVisible);
        if (found.length > 0) {
          nodes = found;
          break;
        }
      } catch {}
    }

    if (nodes.length === 0) {
      return { ok: false, reason: 'Yanıt balonu DOM içinde bulunamadı.' };
    }

    const lastNode = nodes[nodes.length - 1];
    const clone = lastNode.cloneNode(true);

    // Kopyala butonları, SVG araç çubukları ve betik etiketlerini temizle
    clone.querySelectorAll('script, style, button, [role="button"], svg').forEach((el) => el.remove());

    const codeBlocks = [];
    const preNodes = Array.from(lastNode.querySelectorAll('pre'));
    preNodes.forEach((pre, idx) => {
      const codeEl = pre.querySelector('code') || pre;
      const cls = (codeEl.className || '') + ' ' + (pre.className || '');
      const langMatch = cls.match(/language-([a-zA-Z0-9_+-]+)|lang-([a-zA-Z0-9_+-]+)/);
      let language = langMatch ? (langMatch[1] || langMatch[2]) : 'text';
      if (language === 'text') {
        const header = pre.previousElementSibling || pre.parentElement?.querySelector('span, div');
        const headerTxt = header ? (header.textContent || '').trim().toLowerCase() : '';
        if (/^(ts|tsx|js|jsx|json|html|css|python|py|bash|sh|sql|md|yaml)$/.test(headerTxt)) {
          language = headerTxt;
        }
      }
      const code = (codeEl.innerText || codeEl.textContent || '').replace(/\\u00a0/g, ' ').trimEnd();
      if (code.trim().length > 0) {
        const firstLine = code.split('\\n')[0] || '';
        const fileHintMatch = firstLine.match(/(?:\\/\\/|#|<!--)\\s*(?:file:|dosya:)?\\s*([a-zA-Z0-9_./-]+\\.[a-zA-Z0-9]+)/i);
        codeBlocks.push({
          id: 'block_' + (idx + 1),
          language,
          fileHint: fileHintMatch ? fileHintMatch[1] : null,
          code
        });
      }
    });

    return {
      ok: true,
      html: clone.innerHTML,
      plainText: (clone.innerText || clone.textContent || '').trim(),
      codeBlocks
    };
  })()`;
}

function buildClickStopScript(stopSelectors) {
  return `(() => {
    const selectors = ${JSON.stringify(stopSelectors || [])};
    for (const sel of selectors) {
      try {
        const btn = document.querySelector(sel);
        if (btn) {
          btn.click();
          return { ok: true };
        }
      } catch {}
    }
    return { ok: false };
  })()`;
}

module.exports = {
  buildFocusInputScript,
  buildClickSendScript,
  buildCheckStatusScript,
  buildExtractResponseScript,
  buildClickStopScript,
};
