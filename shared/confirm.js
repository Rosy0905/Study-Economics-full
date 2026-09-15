/* ============================================================
   统一的确认弹层（替代 window.confirm，规避微信内核 bug）
   - 主页与 8 个子页共用这一份实现，改一次全站生效
   - 在 ai-assistant.js 之前引入即可，全局 window.showConfirm(opts) 可用
   - opts: { title, message, okText, cancelText, danger } -> Promise<boolean>
   ============================================================ */
(function () {
  'use strict';
  if (window.showConfirm) return;

  var CSS = `
.ai-confirm-overlay{
  position:fixed;inset:0;z-index:4000;background:rgba(16,40,28,.42);
  display:flex;align-items:center;justify-content:center;padding:24px;
  opacity:0;transition:opacity .18s;
  -webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);
}
.ai-confirm-overlay.show{opacity:1;}
.ai-confirm-box{
  width:min(320px,100%);background:#fff;border-radius:16px;
  box-shadow:0 20px 60px rgba(20,50,30,.28);
  padding:20px 20px 16px;transform:translateY(8px) scale(.96);
  transition:transform .22s cubic-bezier(.34,1.56,.64,1);
}
.ai-confirm-overlay.show .ai-confirm-box{transform:translateY(0) scale(1);}
.ai-confirm-title{font-size:15px;font-weight:700;color:#1e4a2a;margin-bottom:8px;}
.ai-confirm-msg{font-size:13.5px;color:#4a6a58;line-height:1.65;
  white-space:pre-wrap;word-break:break-word;margin-bottom:16px;
  max-height:40vh;overflow-y:auto;}
.ai-confirm-actions{display:flex;gap:10px;justify-content:flex-end;}
.ai-confirm-btn{
  flex:0 0 auto;min-width:76px;padding:9px 16px;border-radius:10px;
  font-size:13.5px;font-weight:600;cursor:pointer;border:none;font-family:inherit;
  transition:.15s;
}
.ai-confirm-btn.cancel{background:#f0f5f2;color:#5a7a68;}
@media (hover: hover) and (pointer: fine) {
  .ai-confirm-btn.cancel:hover{background:#e4eee8;}
}
.ai-confirm-btn.cancel:active{background:#e4eee8;}
.ai-confirm-btn.ok{background:linear-gradient(135deg,#5ec99a,#3fa87a);color:#fff;
  box-shadow:0 3px 10px rgba(63,168,122,.26);}
.ai-confirm-btn.ok.danger{background:linear-gradient(135deg,#f08a72,#e05a4a);
  box-shadow:0 3px 10px rgba(224,90,74,.26);}
@media (hover: hover) and (pointer: fine) {
  .ai-confirm-btn.ok:hover{filter:brightness(1.05);}
}
.ai-confirm-btn.ok:active{filter:brightness(1.05);}
`;

  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function showConfirm(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'ai-confirm-overlay';
      overlay.innerHTML =
        '<div class="ai-confirm-box">' +
          '<div class="ai-confirm-title">' + escapeHtml(opts.title || '确认') + '</div>' +
          '<div class="ai-confirm-msg">' + escapeHtml(opts.message || '') + '</div>' +
          '<div class="ai-confirm-actions">' +
            '<button class="ai-confirm-btn ok' + (opts.danger ? ' danger' : '') + '">' +
              escapeHtml(opts.okText || '确定') + '</button>' +
            '<button class="ai-confirm-btn cancel">' + escapeHtml(opts.cancelText || '取消') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      requestAnimationFrame(function () { overlay.classList.add('show'); });

      var settled = false;
      function close(result) {
        if (settled) return;
        settled = true;
        overlay.classList.remove('show');
        setTimeout(function () { overlay.remove(); }, 200);
        resolve(result);
      }
      overlay.querySelector('.ai-confirm-btn.cancel').addEventListener('click', function (e) {
        e.stopPropagation(); close(false);
      });
      overlay.querySelector('.ai-confirm-btn.ok').addEventListener('click', function (e) {
        e.stopPropagation(); close(true);
      });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close(false);
      });
      var onKey = function (e) {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); }
      };
      document.addEventListener('keydown', onKey);
    });
  }

  window.showConfirm = showConfirm;
})();
