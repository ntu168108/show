// ==UserScript==
// @name         Grab m3u8 + vtt (allowlist, filename, filter cvt.*, robust copy)
// @namespace    https://tampermonkey.net/
// @version      3.5
// @description  Hook fetch/XHR (page) trên domain cho phép; lôi .m3u8/.vtt; hiển thị tên file; ẩn host cvt.*; UI copy/save; copy fallback 3 lớp
// @match        *://*/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  /* ------------ ALLOW LIST (sửa tùy ý) ------------ */
  const ALLOW_HOST_REGEXES = [
    /(^|\.)rophim\./i,
    /(^|\.)goatembed\./i,
    /(^|\.)hitmefirstcdn\./i,
    /(^|\.)nutscdn\.com$/i,
    /(^|\.)finallygotthexds\.site$/i,
    /(^|\.)quetinuk\d*\.site$/i
  ];
  const BLOCK_HOST_PREFIXES = ['cvt.'];   // ẩn mọi host bắt đầu bằng 'cvt.'
  /* ------------------------------------------------ */

  const allowedHost = (h) => ALLOW_HOST_REGEXES.some(re => re.test(h));
  if (!allowedHost(location.hostname)) return;

  /* ---------------- state ---------------- */
  const found = new Set();
  let paused = false;
  const MAX_ITEMS = 400;

  /* ---------------- helpers ---------------- */
  const absURL = (u) => { try { return new URL(u, location.href).toString(); } catch { return null; } };
  const isTargetURL = (u) => !!u && (u.toLowerCase().includes('.m3u8') || u.toLowerCase().includes('.vtt'));
  const isTargetCT  = (ct) => /vtt|mpegurl/i.test(ct || '');
  const badge = (u) => (String(u).toLowerCase().includes('.vtt') ? 'VTT' : 'M3U8');
  const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
  const truncate = (t, n=72) => (t && t.length > n ? t.slice(0, n-3) + '...' : t || '');
  const isBlockedHost = (u) => {
    const h = hostOf(u).toLowerCase();
    return !!h && BLOCK_HOST_PREFIXES.some(p => h.startsWith(p.toLowerCase()));
  };
  const fileNameOf = (u) => {
    try {
      const url = new URL(u);
      let name = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
      name = name.split('?')[0].split('#')[0];
      if (!name || !/\.[a-z0-9]{2,5}$/i.test(name)) {
        const keys = ['filename','file','name','title','fname','n'];
        for (const k of keys) { const v = url.searchParams.get(k); if (v) { name = decodeURIComponent(v); break; } }
      }
      return name || '';
    } catch { return ''; }
  };

  // robust copy: clipboard API -> execCommand -> prompt
  async function copyText(text) {
    // 1) Clipboard API (HTTPS + user gesture + policy cho phép)
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    // 2) execCommand fallback
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (ok) return true;
    } catch {}
    // 3) prompt fallback
    try { window.prompt('Copy this:', text); return true; } catch {}
    return false;
  }

  /* ---------------- UI ---------------- */
  let root, listEl, countEl, toastTimer;
  function ensureUI() {
    if (root) return;
    const host = document.createElement('div');
    host.style.position='fixed'; host.style.right='20px'; host.style.bottom='20px'; host.style.zIndex='2147483647';
    host.attachShadow({mode:'open'});
    const append = () => {
      if (document.body) document.body.appendChild(host);
      else new MutationObserver((_,o)=>{ if(document.body){ document.body.appendChild(host); o.disconnect(); } })
        .observe(document.documentElement||document, {childList:true,subtree:true});
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', append); else append();

    root = host.shadowRoot;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <style>
        :host{all:initial}
        .panel{width:440px;max-height:440px;background:rgba(18,18,18,.92);color:#fff;border-radius:14px;
               border:1px solid rgba(255,255,255,.08);box-shadow:0 10px 30px rgba(0,0,0,.35);
               display:flex;flex-direction:column;overflow:hidden;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace}
        .hdr{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:move;
             background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,0));user-select:none}
        .dot{width:10px;height:10px;border-radius:50%;background:#ff5f56;box-shadow:14px 0 0 #ffbd2e,28px 0 0 #27c93f}
        .title{font-weight:700;letter-spacing:.3px}
        .sp{flex:1}
        .btn{appearance:none;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;
             padding:6px 9px;border-radius:8px;cursor:pointer}
        .btn:hover{background:rgba(255,255,255,.12)}
        .btn:active{transform:translateY(1px)}
        .toolbar{display:flex;gap:8px;padding:8px 12px;flex-wrap:wrap;align-items:center}
        .chip{font-size:11px;padding:3px 7px;border-radius:999px;background:#2b2b2b;border:1px solid rgba(255,255,255,.15);opacity:.8}
        .list{overflow:auto;padding:8px 10px 12px;display:flex;flex-direction:column;gap:8px}
        .row{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;padding:8px 10px;
             background:#121212;border:1px solid rgba(255,255,255,.10);border-radius:10px}
        .badge{font-size:11px;font-weight:700;padding:3px 7px;border-radius:999px;background:#2b2b2b;
               border:1px solid rgba(255,255,255,.15)}
        .badge[data-type="M3U8"]{background:#1b2a3a}
        .badge[data-type="VTT"]{background:#2a1b3a}
        .name{font-weight:700;color:#ffe599;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}
        .url{word-break:break-all;text-decoration:none;color:#d7eaff}
        .host{opacity:.7;font-size:11px;margin-right:6px}
        .copy{padding:5px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.2);
              background:rgba(255,255,255,.08);color:#fff;cursor:pointer}
        .copy:hover{background:rgba(255,255,255,.18)}
        .toast{position:absolute;right:16px;bottom:14px;background:#1f6feb;color:#fff;padding:6px 10px;border-radius:8px;
               opacity:0;transition:.18s}
        .toast.show{opacity:1;transform:translateY(-4px)}
        .hidden{display:none!important}
      </style>
      <div class="panel" id="panel">
        <div class="hdr" id="drag">
          <div class="dot"></div>
          <div class="title">🎯 Link Grabbed <span id="count">(0)</span></div>
          <div class="sp"></div><button class="btn" id="minBtn">–</button>
        </div>
        <div class="toolbar">
          <button class="btn" id="copyAll">Copy All</button>
          <button class="btn" id="saveTxt">Save .txt</button>
          <button class="btn" id="clear">Clear</button>
          <button class="btn" id="toggle">${paused ? 'Resume' : 'Pause'}</button>
          <span class="chip">scope: allowlist • filter: <b>cvt.*</b> hidden</span>
        </div>
        <div class="list" id="list"></div>
        <div class="toast" id="toast">Copied!</div>
      </div>
      <div class="hidden" id="mini"><button class="btn">🎯 Links <span id="count2">(0)</span></button></div>
    `;
    root.appendChild(wrap);

    const list  = root.querySelector('#list');
    listEl  = list;
    countEl = root.querySelector('#count');
    const count2 = root.querySelector('#count2');
    const toast  = root.querySelector('#toast');

    const showToast = (msg='Copied!') => {
      toast.textContent = msg; toast.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(()=>toast.classList.remove('show'), 900);
    };

    root.querySelector('#copyAll').onclick = async () => {
      const arr = [...found]; if (!arr.length) return showToast('No links');
      const ok = await copyText(arr.join('\n'));
      showToast(ok ? 'Copied all' : 'Copy failed');
    };
    root.querySelector('#saveTxt').onclick = () => {
      const arr = [...found]; if (!arr.length) return showToast('No links');
      const blob = new Blob([arr.join('\n')], {type:'text/plain'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `links-${Date.now()}.txt`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
    };
    root.querySelector('#clear').onclick = () => {
      found.clear(); list.innerHTML = ''; countEl.textContent='(0)'; count2.textContent='(0)'; showToast('Cleared');
    };
    root.querySelector('#toggle').onclick = (e) => {
      paused = !paused; e.currentTarget.textContent = paused ? 'Resume' : 'Pause';
      showToast(paused ? 'Paused' : 'Resumed');
    };
    root.querySelector('#minBtn').onclick = () => { root.querySelector('#panel').classList.add('hidden'); root.querySelector('#mini').classList.remove('hidden'); };
    root.querySelector('#mini').onclick  = () => { root.querySelector('#mini').classList.add('hidden'); root.querySelector('#panel').classList.remove('hidden'); };

    // drag
    (() => {
      const dragEl = root.querySelector('#drag'); let sx,sy,ox=20,oy=20, dragging=false;
      const update = () => { host.style.left='unset'; host.style.top='unset'; host.style.right=`${ox}px`; host.style.bottom=`${oy}px`; };
      update();
      dragEl.addEventListener('mousedown', (ev)=>{ dragging=true; sx=ev.clientX; sy=ev.clientY; ev.preventDefault(); });
      window.addEventListener('mousemove', (ev)=>{ if(!dragging) return; ox -= (ev.clientX-sx); oy -= (ev.clientY-sy); sx=ev.clientX; sy=ev.clientY; update(); });
      window.addEventListener('mouseup', ()=> dragging=false);
    })();

    root.addLink = async (url) => {
      if (found.has(url)) return;
      found.add(url);
      if (found.size > MAX_ITEMS) { const first=[...found][0]; found.delete(first); list.firstChild && list.firstChild.remove(); }
      const name = fileNameOf(url);
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <span class="badge" data-type="${badge(url)}">${badge(url)}</span>
        <div>
          ${name ? `<div class="name" title="${name}">🏷️ ${truncate(name, 48)}</div>` : ''}
          <div><span class="host">${hostOf(url)}</span>
               <a class="url" href="${url}" target="_blank" rel="noopener">${truncate(url)}</a></div>
        </div>
        <button class="copy">Copy</button>`;
      row.querySelector('.copy').onclick = async () => {
        const ok = await copyText(url);
        showToast(ok ? 'Copied' : 'Copy failed');
      };
      list.appendChild(row);
      list.scrollTop = list.scrollHeight;
      countEl.textContent = `(${found.size})`; count2.textContent = `(${found.size})`;
    };

    console.log('[Grabber] UI ready (allowlist + robust copy)');
  }

  /* ---------------- core hooks ---------------- */
  function addURL(u) {
    if (paused) return;
    const url = absURL(u);
    if (!url) return;
    if (isBlockedHost(url)) return;       // ẩn cvt.*
    if (isTargetURL(url)) { ensureUI(); root.addLink(url); }
  }

  // XHR
  (function hookXHR(){
    const XHROpen = XMLHttpRequest.prototype.open;
    const XHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      try { addURL(url); } catch {}
      return XHROpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(...args) {
      this.addEventListener('load', function() {
        try {
          const ct = this.getResponseHeader?.('content-type') || '';
          if (!isTargetURL(this.responseURL) && isTargetCT(ct)) addURL(this.responseURL);
        } catch {}
      });
      return XHRSend.apply(this, args);
    };
  })();

  // fetch
  (function hookFetch(){
    if (!window.fetch) return;
    const _fetch = window.fetch;
    window.fetch = function(input, init) {
      try { const url = typeof input === 'string' ? input : input?.url; addURL(url); } catch {}
      return _fetch.call(this, input, init).then(res => {
        try {
          const ct = res.headers?.get?.('content-type') || '';
          if (!isTargetURL(res.url) && isTargetCT(ct)) addURL(res.url);
        } catch {}
        return res;
      });
    };
  })();

  // fallback: quét DOM
  setInterval(() => {
    try {
      document.querySelectorAll('video[src], source[src], track[src]').forEach(el => {
        const u = el.currentSrc || el.src || el.getAttribute('src'); if (u) addURL(u);
      });
    } catch {}
  }, 1500);

  ensureUI();
  console.log('[Grabber 3.5] hooked at page-level on:', location.hostname);
})();
