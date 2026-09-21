/* ============================================================
   存储安全（8 个子页共用）
   - 笔记图片自动压缩：原图 base64 极易撑爆 localStorage（约 5MB 上限）
   - 笔记自动保存（输入停 900ms 后落盘）
   - 离开页面前提醒未保存的笔记
   原先 8 个子页各内嵌一份完全相同（2875 字符）的副本，现收到这里。
   加载顺序：必须在子页的主 <script> 之后（要能拿到 notes / saveNotes）。
   ============================================================ */

/* ===== 存储安全：图片压缩 + 笔记自动保存 + 离开提醒 ===== */
(function () {
    var MAXW = 1200, QUALITY = 0.72, KEEP_UNDER = 220 * 1024;
    var dirty = false, timer = null;

    /* 压缩笔记里的图片：原图 base64 极易撑爆 localStorage（约 5MB 上限） */
    window.__shrinkNoteImg = function (img, dataUrl) {
        if (!img || !dataUrl || dataUrl.indexOf('data:image/') !== 0) return;
        if (dataUrl.length < KEEP_UNDER) return;
        var im = new Image();
        im.onload = function () {
            try {
                var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
                var scale = Math.min(1, MAXW / (w || 1));
                var c = document.createElement('canvas');
                c.width = Math.max(1, Math.round(w * scale));
                c.height = Math.max(1, Math.round(h * scale));
                var ctx = c.getContext('2d');
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(im, 0, 0, c.width, c.height);
                var out = c.toDataURL('image/jpeg', QUALITY);
                if (out && out.length < dataUrl.length) {
                    img.src = out;
                    img.dataset.shrunk = '1';
                    schedule(img);
                }
            } catch (e) {}
        };
        im.src = dataUrl;
    };

    function saveFrom(el) {
        var ed = el && el.closest ? el.closest('.note-editor') : null;
        if (!ed) return;
        try {
            var id = ed.dataset.id;
            /* 26/09/21 第 43 轮：自动保存发生在公式渲染之后，直接存 ed.innerHTML 会把渲染后的
               KaTeX HTML（体积 25 倍、源码丢失）写回 localStorage，把「保存」按钮刚存好的源码覆盖掉。
               这里统一先把公式还原成 $...$ 源码（在离屏副本上做，页面上的公式不动）。 */
            var raw = (ed.innerHTML || '').trim();
            var content = (window.__richNote && window.__richNote.deflateMathHtml)
                ? window.__richNote.deflateMathHtml(raw).trim() : raw;
            if (content === '<br>' || content === '') content = '';
            if (content) { notes[id] = content; } else { delete notes[id]; }
            saveNotes();
        } catch (e) {
            var btn = document.querySelector('.note-save[data-id="' + (ed.dataset.id || '') + '"]');
            if (btn) btn.click();
        }
    }

    function schedule(el) {
        dirty = true;
        clearTimeout(timer);
        timer = setTimeout(function () {
            try { saveFrom(el); dirty = false; } catch (e) {}
        }, 900);
    }

    document.addEventListener('input', function (e) {
        var ed = e.target && e.target.closest ? e.target.closest('.note-editor') : null;
        if (ed) schedule(ed);
    }, true);

    document.addEventListener('paste', function (e) {
        var ed = e.target && e.target.closest ? e.target.closest('.note-editor') : null;
        if (ed) setTimeout(function () { schedule(ed); }, 150);
    }, true);

    /* 手动点过保存就认为已保存，不再拦离开 */
    document.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('.note-save')) dirty = false;
    }, true);

    window.addEventListener('beforeunload', function (e) {
        if (!dirty) return;
        e.preventDefault();
        e.returnValue = '';
        return '';
    });
})();
