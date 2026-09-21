/* ============================================================================
   ai-cards-bridge.js  ——  在「AI 答疑助手」聊天窗里加两个入口，把 AI 回答变成卡片
   ----------------------------------------------------------------------------
   干什么：
     1. 聊天窗右上角加一个 🗂 按钮 → 新标签页打开「我的卡片」页
     2. 每条 AI 回答右下角（原来只有 复制/重新生成/删除）多一个 🗂 按钮 →
        把「你的提问 + 这条回答」存成一张卡片，直接写进 custom_cards_v1

   怎么装（只加一行，不改 ai-assistant.js）：
     在每个子页 / index.html 里，找到引入 AI 助手的那个 <script src="...ai-assistant.js"></script>
     紧跟其后加一行：
         <script src="ai-cards-bridge.js"></script>
     （路径按你的实际位置写；本文件放在项目根目录最省事）

   前提：本文件、子页、我的卡片页在**同一个站点目录**下（同源），localStorage 才通。
   ========================================================================== */
(function () {
    'use strict';

    /* ===================== 需要你确认的配置 ===================== */
    // 「我的卡片」页的地址（相对当前页面写）
    // 想临时改（比如看演示），也可以在本文件之前写一行：
    //     <script>window.MY_CARDS_URL_OVERRIDE = 'my-cards-v2.html';</script>
    var MY_CARDS_URL = window.MY_CARDS_URL_OVERRIDE || '../9my-cards/index.html';
    // 点聊天窗里的入口，是开新标签页（true）还是原地跳转（false）
    var OPEN_IN_NEW_TAB = true;
    // 存卡片时的默认分类
    var DEFAULT_SUBJECT = '微观';
    // ==========================================================

    var CARDS_KEY = 'custom_cards_v1';
    var CHAPTER_KEY = 'custom_chapters_v2';   // 26/09/20 第7轮起：章节按分类分开存 { 微观:[…], 宏观:[…] }
    var AI_HISTORY_KEY = 'ai_assistant_history_v1';

    /* ---------------- 小工具 ---------------- */
    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function safeText(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
    function readJson(key, dft) {
        try { var raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) || dft) : dft; }
        catch (e) { return dft; }
    }

    /* ---------------- markdown -> 富文本 HTML（与我的卡片页同一套规则） ---------------- */
    function inlineMd(s) {
        var t = esc(s);
        /* 26/09/21：先保护 $...$ / $$...$$ 公式，避免 * 斜体破坏 LaTeX 结构 */
        var maths = [];
        t = t.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, function (m) {
            maths.push(m);
            return '\u0000M' + (maths.length - 1) + '\u0000';
        });
        t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
        t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
        t = t.replace(/~~([^~]+)~~/g, '<s>$1</s>');
        t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        t = t.replace(/\u0000M(\d+)\u0000/g, function (_, i) { return maths[+i]; });
        return t;
    }
    function isTableRow(s) { return /^\s*\|.*\|\s*$/.test(s); }
    function isTableSep(s) { return /^\s*\|?[\s:\-|]+\|[\s:\-|]*$/.test(s) && /-/.test(s); }
    function splitRow(s) {
        return s.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (x) { return x.trim(); });
    }
    function mdToHtml(md) {
        var src = String(md || '').replace(/\r\n?/g, '\n');
        var fences = [];
        src = src.replace(/```[^\n]*\n([\s\S]*?)```/g, function (m, code) {
            fences.push('<pre><code>' + esc(code.replace(/\n+$/, '')) + '</code></pre>');
            return '\n\u0000F' + (fences.length - 1) + '\u0000\n';
        });
        var lines = src.split('\n'), out = [], i = 0;
        while (i < lines.length) {
            var line = lines[i];
            if (!line.trim()) { i++; continue; }
            var fm = line.trim().match(/^\u0000F(\d+)\u0000$/);
            if (fm) { out.push(fences[+fm[1]] || ''); i++; continue; }

            if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
                var head = splitRow(line); i += 2; var rows = [];
                while (i < lines.length && isTableRow(lines[i])) { rows.push(splitRow(lines[i])); i++; }
                out.push('<table><thead><tr>' +
                    head.map(function (h) { return '<th>' + inlineMd(h) + '</th>'; }).join('') +
                    '</tr></thead><tbody>' +
                    rows.map(function (r) {
                        return '<tr>' + head.map(function (_, ci) { return '<td>' + inlineMd(r[ci] || '') + '</td>'; }).join('') + '</tr>';
                    }).join('') + '</tbody></table>');
                continue;
            }
            var h = line.match(/^(#{1,6})\s+(.*)$/);
            if (h) { var lv = Math.min(6, h[1].length); out.push('<h' + lv + '>' + inlineMd(h[2]) + '</h' + lv + '>'); i++; continue; }
            if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { out.push('<hr>'); i++; continue; }
            if (/^\s*>\s?/.test(line)) {
                var q = [];
                while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
                out.push('<blockquote>' + q.map(inlineMd).join('<br>') + '</blockquote>');
                continue;
            }
            if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
                var ordered = /^\s*\d+[.)]\s+/.test(line), items = [];
                while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
                    items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, '')); i++;
                }
                out.push('<' + (ordered ? 'ol' : 'ul') + '>' +
                    items.map(function (t) { return '<li>' + inlineMd(t) + '</li>'; }).join('') +
                    '</' + (ordered ? 'ol' : 'ul') + '>');
                continue;
            }
            var para = [];
            while (i < lines.length && lines[i].trim() &&
                   !/^\s*>\s?/.test(lines[i]) &&
                   !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) &&
                   !/^#{1,6}\s+/.test(lines[i]) &&
                   !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1])) &&
                   !/^\u0000F\d+\u0000$/.test(lines[i].trim())) {
                para.push(lines[i]); i++;
            }
            if (!para.length) { i++; continue; }
            out.push('<p>' + para.map(inlineMd).join('\n') + '</p>');
        }
        return out.join('');
    }
    function mdPlain(s) {
        return String(s || '')
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/^\s{0,3}#{1,6}\s+/gm, '')
            .replace(/^\s*>\s?/gm, '')
            .replace(/^\s*([-*+]|\d+[.)])\s+/gm, '')
            .replace(/\*\*|__|~~|`/g, '').replace(/[*_]/g, '');
    }
    function oneLine(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

    /* ---------------- 存卡片 ---------------- */
    function saveCard(question, answerMdOrHtml, isHtml, subject, chapter, originalQuestion) {
        var answerHtml = answerMdOrHtml || '';
        var cards = readJson(CARDS_KEY, []);
        if (!Array.isArray(cards)) cards = [];
        // 防重复：题目+答案内容一样就不重复存
        var q = oneLine(question) || oneLine(mdPlain(isHtml ? '' : answerHtml)).slice(0, 60) || '（AI 回答）';
        var subj = (subject === '宏观' ? '宏观' : '微观');
        var dup = cards.some(function (c) {
            return c && String(c.answerHtml || '') === answerHtml &&
                (c.question === q || c.originalQuestion === q || (!c.originalQuestion && c.question === q));
        });
        if (dup) { toast('这张卡片已经有了'); return false; }
        cards.push({
            id: uid(),
            subject: subj,
            chapter: String(chapter || '').trim(),
            qid: '',
            hasImage: /<img/i.test(answerHtml),
            question: q,
            originalQuestion: oneLine(originalQuestion || question) || q,
            answerHtml: answerHtml,
            fav: false,
            created: Date.now()
        });
        try {
            localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
            if (localStorage.getItem(CHAPTER_KEY) === null) {
                localStorage.setItem(CHAPTER_KEY, '{"微观":[],"宏观":[]}');
            }
        } catch (e) {
            toast('存不下了，去「我的卡片」里导出清理一下');
            return false;
        }
        return true;
    }
    function removeCard(question, answerHtml) {
        var q = oneLine(question) || oneLine(mdPlain(answerHtml)).slice(0, 60) || '（AI 回答）';
        var cards = readJson(CARDS_KEY, []);
        if (!Array.isArray(cards)) cards = [];
        var before = cards.length;
        cards = cards.filter(function (c) {
            if (!c || String(c.answerHtml || '') !== answerHtml) return true;
            if (c.originalQuestion && c.originalQuestion === q) return false;
            if (c.question === q) return false;
            return true;
        });
        if (cards.length === before) { toast('卡片已不存在'); return false; }
        try { localStorage.setItem(CARDS_KEY, JSON.stringify(cards)); }
        catch (e) { toast('移除失败，存储受限'); return false; }
        return true;
    }
    function isSaved(question, answerHtml) {
        var q = oneLine(question) || oneLine(mdPlain(answerHtml)).slice(0, 60) || '（AI 回答）';
        var cards = readJson(CARDS_KEY, []);
        if (!Array.isArray(cards)) return false;
        return cards.some(function (c) {
            if (!c || String(c.answerHtml || '') !== answerHtml) return false;
            if (c.originalQuestion && c.originalQuestion === q) return true;
            return c.question === q;
        });
    }

    /* ---------------- 存卡片前的确认弹窗 ----------------
       26/09/21：弹窗里可以编辑题目、编辑答案、选宏观/微观、选章节，
       确认后才按用户选好的分类和章节存进去。 */
    var confirmOv = null;
    function readChapters() {
        var ch = readJson(CHAPTER_KEY, null);
        if (!ch || typeof ch !== 'object') return { '微观': [], '宏观': [] };
        return {
            '微观': Array.isArray(ch['微观']) ? ch['微观'] : [],
            '宏观': Array.isArray(ch['宏观']) ? ch['宏观'] : []
        };
    }
    function buildChapterOptions(subject, selected) {
        var list = readChapters()[subject] || [];
        var html = '<option value="">不选章节</option>';
        list.forEach(function (ch) {
            html += '<option value="' + safeText(ch) + '"' + (ch === selected ? ' selected' : '') + '>' + safeText(ch) + '</option>';
        });
        return html;
    }
    function askSave(question, answerHtml) {
        return new Promise(function (resolve) {
            closeConfirm();
            var qText = oneLine(question) || '（AI 回答）';
            var preview = sanitizePreview(answerHtml);
            var subject = DEFAULT_SUBJECT;
            var lastChapter = '';
            /* 如果“我的卡片”里记住了上次用的分类/章节，优先用那个 */
            try {
                var lastCfg = JSON.parse(localStorage.getItem('ai_cards_last_cfg') || '{}');
                if (lastCfg.subject) subject = lastCfg.subject;
                if (lastCfg.chapter) lastChapter = lastCfg.chapter;
            } catch (e) {}

            confirmOv = document.createElement('div');
            confirmOv.className = 'mycards-confirm-ov';
            confirmOv.innerHTML =
                '<div class="mycards-confirm-box">' +
                  '<div class="mycards-confirm-title">存成卡片</div>' +
                  '<div class="mycards-confirm-row">' +
                    '<label>分类</label>' +
                    '<select class="mycards-select mycards-subject"><option value="微观">微观</option><option value="宏观">宏观</option></select>' +
                    '<label>章节</label>' +
                    '<select class="mycards-select mycards-chapter"></select>' +
                  '</div>' +
                  '<div class="mycards-confirm-sub">题目（可直接编辑）</div>' +
                  '<div class="mycards-confirm-q" contenteditable="plaintext-only" spellcheck="false"></div>' +
                  '<div class="mycards-confirm-sub">答案预览</div>' +
                  '<div class="mycards-confirm-a"></div>' +
                  '<div class="mycards-confirm-btns">' +
                    '<button type="button" class="mycards-btn mycards-btn-cancel">取消</button>' +
                    '<button type="button" class="mycards-btn mycards-btn-ok">存入</button>' +
                  '</div>' +
                '</div>';
            document.body.appendChild(confirmOv);

            var subjSel = confirmOv.querySelector('.mycards-subject');
            var chapSel = confirmOv.querySelector('.mycards-chapter');
            var qBox = confirmOv.querySelector('.mycards-confirm-q');
            var aBox = confirmOv.querySelector('.mycards-confirm-a');

            subjSel.value = subject;
            chapSel.innerHTML = buildChapterOptions(subject, lastChapter);
            subjSel.addEventListener('change', function () {
                var prev = chapSel.value;
                chapSel.innerHTML = buildChapterOptions(subjSel.value, prev);
            });

            qBox.textContent = qText;
            aBox.innerHTML = preview || '<span style="color:#9ab;">（空内容）</span>';

            /* 26/09/21：粘贴时强制纯文本，保持题目区固定样式 */
            qBox.addEventListener('paste', function (e) {
                e.preventDefault();
                var text = '';
                try { text = (e.clipboardData || window.clipboardData).getData('text/plain'); }
                catch (err) {}
                document.execCommand('insertText', false, text);
            });

            requestAnimationFrame(function () { if (confirmOv) confirmOv.classList.add('show'); });

            var finish = function (v) { closeConfirm(); resolve(v); };
            confirmOv.querySelector('.mycards-btn-cancel').addEventListener('click', function () { finish({ ok: false }); });
            confirmOv.querySelector('.mycards-btn-ok').addEventListener('click', function () {
                try {
                    localStorage.setItem('ai_cards_last_cfg', JSON.stringify({ subject: subjSel.value, chapter: chapSel.value }));
                } catch (e) {}
                finish({
                    ok: true,
                    question: qBox.textContent || qText,
                    originalQuestion: qText,
                    answerHtml: answerHtml,
                    subject: subjSel.value,
                    chapter: chapSel.value
                });
            });
            confirmOv.addEventListener('click', function (e) { if (e.target === confirmOv) finish({ ok: false }); });
        });
    }
    function askRemove(question) {
        return new Promise(function (resolve) {
            closeConfirm();
            var qText = oneLine(question) || '这条回答';
            confirmOv = document.createElement('div');
            confirmOv.className = 'mycards-confirm-ov';
            confirmOv.innerHTML =
                '<div class="mycards-confirm-box">' +
                  '<div class="mycards-confirm-title">移出卡片</div>' +
                  '<div class="mycards-confirm-sub">题目</div>' +
                  '<div class="mycards-confirm-q"></div>' +
                  '<div class="mycards-confirm-btns">' +
                    '<button type="button" class="mycards-btn mycards-btn-cancel">取消</button>' +
                    '<button type="button" class="mycards-btn mycards-btn-ok mycards-btn-remove">移出</button>' +
                  '</div>' +
                '</div>';
            document.body.appendChild(confirmOv);
            confirmOv.querySelector('.mycards-confirm-q').textContent = qText;
            requestAnimationFrame(function () { if (confirmOv) confirmOv.classList.add('show'); });
            var finish = function (v) { closeConfirm(); resolve(v); };
            confirmOv.querySelector('.mycards-btn-cancel').addEventListener('click', function () { finish(false); });
            confirmOv.querySelector('.mycards-btn-ok').addEventListener('click', function () { finish(true); });
            confirmOv.addEventListener('click', function (e) { if (e.target === confirmOv) finish(false); });
        });
    }

    function closeConfirm() {
        if (!confirmOv) return;
        var el = confirmOv; confirmOv = null;
        el.classList.remove('show');
        setTimeout(function () { try { el.remove(); } catch (e) {} }, 200);
    }
    /* 预览区不放大段图片/脚本，只保留能看清结构的 HTML */
    function sanitizePreview(html) {
        var box = document.createElement('div');
        box.innerHTML = String(html || '');
        box.querySelectorAll('script,style,img,video,iframe').forEach(function (n) {
            var tag = document.createElement('span');
            tag.textContent = '［' + (n.tagName === 'IMG' ? '图片' : '媒体') + '］';
            n.parentNode && n.parentNode.replaceChild(tag, n);
        });
        return box.innerHTML;
    }

    /* ---------------- 自带一个小 toast（不依赖页面的实现） ---------------- */
    var toastEl = null, toastTimer = null;
    function toast(msg) {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.style.cssText = 'position:fixed;left:50%;bottom:36px;transform:translateX(-50%);' +
                'background:#2a4a2a;color:#f0faf0;padding:9px 22px;border-radius:40px;font-size:13.5px;' +
                'box-shadow:0 6px 24px rgba(0,0,0,.25);z-index:2147483000;opacity:0;transition:opacity .25s;' +
                'pointer-events:none;font-family:inherit;max-width:80vw;text-align:center;';
            document.body.appendChild(toastEl);
        }
        clearTimeout(toastTimer);
        toastEl.textContent = msg;
        toastEl.style.opacity = '1';
        toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, 2000);
    }

    /* ---------------- 注入样式 ---------------- */
    function injectCss() {
        if (document.getElementById('mycards-bridge-css')) return;
        var st = document.createElement('style');
        st.id = 'mycards-bridge-css';
        st.textContent =
            /* 26/09/21：未保存时和另外三个按钮完全一致（白底+淡绿阴影），只有保存后才变绿 */
            '.ai-msg-actions .mycards-act{background:rgba(255,255,255,.85);color:#6a8f76;box-shadow:0 1px 4px rgba(0,0,0,.06);}' +
            '@media (hover:hover) and (pointer:fine){.ai-msg-actions .mycards-act:hover{background:#eaf8f2;color:#3fa87a;transform:scale(1.08);}}' +
            '.ai-msg-actions .mycards-act:active{background:#eaf8f2;color:#3fa87a;transform:scale(.94);}' +
            '.ai-msg-actions .mycards-act.saved{background:#eaf8f0;color:#2f7d55;}' +
            '@media (hover:hover) and (pointer:fine){.ai-msg-actions .mycards-act.saved:hover{background:#d8f0e2;color:#1f6440;}}' +
            /* 确认弹窗 */
            '.mycards-confirm-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(16,40,28,.42);' +
            'display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .18s;}' +
            '.mycards-confirm-ov.show{opacity:1;}' +
            '.mycards-confirm-box{width:100%;max-width:560px;max-height:82vh;display:flex;flex-direction:column;' +
            'background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(20,50,35,.28);padding:18px 18px 14px;' +
            'font-family:inherit;transform:translateY(10px);transition:transform .18s;}' +
            '.mycards-confirm-ov.show .mycards-confirm-box{transform:translateY(0);}' +
            '.mycards-confirm-title{font-size:15.5px;font-weight:700;color:#1e5a3a;margin-bottom:2px;}' +
            '.mycards-confirm-row{display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap;}' +
            '.mycards-confirm-row label{font-size:12px;color:#8aa;}' +
            '.mycards-select{appearance:none;-webkit-appearance:none;border:1px solid #d5e8de;border-radius:20px;' +
            'background:#f8fbf9 url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236a8f76%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E") no-repeat right 10px center;' +
            'padding:7px 26px 7px 12px;font-size:13px;color:#1c3322;font-family:inherit;cursor:pointer;outline:none;}' +
            '.mycards-select:focus{border-color:#8bcbb0;background-color:#f3faf6;}' +
            '.mycards-confirm-sub{font-size:12px;color:#8aa;margin-top:10px;margin-bottom:4px;}' +
            '.mycards-confirm-q{font-size:13.5px;color:#1c3322;font-weight:700;line-height:1.6;' +
            'background:#f3faf6;border-radius:9px;padding:8px 10px;outline:none;min-height:26px;' +
            'white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;max-height:22vh;overflow-y:auto;}' +
            '.mycards-confirm-q:focus{box-shadow:0 0 0 2px #c8ead8;}' +
            '.mycards-confirm-a{max-height:50vh;overflow-y:auto;font-size:13px;color:#3a5a48;line-height:1.7;' +
            'background:#f8fbf9;border:1px solid #e2efe8;border-radius:9px;padding:9px 11px;word-break:break-word;}' +
            '.mycards-confirm-a table{border-collapse:collapse;width:100%;}' +
            '.mycards-confirm-a th,.mycards-confirm-a td{border:1px solid #d5e8de;padding:3px 6px;font-size:12px;}' +
            '.mycards-confirm-a p{margin:0 0 .4em;}' +
            '.mycards-confirm-a img{max-width:100%;}' +
            '.mycards-confirm-btns{display:flex;gap:10px;margin-top:16px;}' +
            '.mycards-btn{flex:1;border:none;border-radius:30px;padding:10px 0;font-size:14px;font-weight:600;' +
            'cursor:pointer;font-family:inherit;transition:filter .15s, background .15s;}' +
            '.mycards-btn-cancel{background:#eef3f0;color:#5b7a68;}' +
            '.mycards-btn-ok{background:#4fb488;color:#fff;}' +
            '.mycards-btn-remove{background:linear-gradient(135deg,#f08a72,#e05a4a);color:#fff;}' +
            '@media (hover:hover) and (pointer:fine){' +
            '.mycards-btn-cancel:hover{background:#e2eae5;}' +
            '.mycards-btn-ok:hover{filter:brightness(1.06);}' +
            '.mycards-btn-remove:hover{filter:brightness(1.06);}}' +
            '@media (max-width:640px){.mycards-confirm-ov{align-items:flex-end;padding:10px;}' +
            '.mycards-confirm-box{max-width:none;border-radius:18px;}}';
        document.head.appendChild(st);
    }

    /* ---------------- 从历史记录里取原始 markdown ---------------- */
    function historyList() {
        var h = readJson(AI_HISTORY_KEY, []);
        return Array.isArray(h) ? h : [];
    }

    /* ---------------- 给一条 AI 回答加「存卡片」按钮 ---------------- */
    var CARD_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M7 3v3M17 3v3M8 12h8M8 16h5"/></svg>';

    function getMsgContent(div) {
        var ans = '';
        var idx = div.dataset.idx;
        /* 1) 优先用历史记录里的原始 markdown（存进卡片后好编辑） */
        if (idx !== undefined && idx !== '') {
            var h = historyList();
            var m = h[+idx];
            if (m && String(m.content || '').trim() && (m.role === 'assistant' || m.role === 'ai')) {
                ans = mdToHtml(m.content);
            }
        }
        /* 2) 拿不到就用 DOM 里已渲染的 HTML */
        if (!ans) {
            var clone = div.cloneNode(true);
            clone.querySelectorAll('.ai-msg-actions, .ai-select-box, .ai-cursor').forEach(function (n) { n.remove(); });
            ans = clone.innerHTML;
        }
        /* 提问：往上找最近的用户消息 */
        var q = '';
        var prev = div.previousElementSibling;
        while (prev) {
            if (prev.classList.contains('user')) { q = prev.textContent || ''; break; }
            if (prev.classList.contains('ai')) break;
            prev = prev.previousElementSibling;
        }
        return { q: q, ans: ans };
    }

    function decorate(div) {
        if (!div || div.classList.contains('sys') || div.classList.contains('err')) return;
        if (!div.classList.contains('ai')) return;
        var wrap = div.querySelector('.ai-msg-actions');
        /* 26/09/21：流式输出刚创建的 AI 气泡还没有 .ai-msg-actions（要等 attachMsgActions 在流式结束后才加），
           这里挂一个临时 observer 等它出现，避免现场问答时按钮出不来、刷新后才出现。 */
        if (!wrap) {
            if (div.__mycardsWaiter) return;
            var mo = new MutationObserver(function (muts, observer) {
                if (div.querySelector('.ai-msg-actions')) {
                    observer.disconnect();
                    div.__mycardsWaiter = null;
                    decorate(div);
                }
            });
            mo.observe(div, { childList: true, subtree: false });
            div.__mycardsWaiter = mo;
            return;
        }
        if (wrap.querySelector('.mycards-act')) return;

        var c = getMsgContent(div);
        var saved = isSaved(c.q, c.ans);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ai-act-btn mycards-act' + (saved ? ' saved' : '');
        btn.title = saved ? '已存成卡片，点击可移出' : '存成一张卡片';
        btn.innerHTML = CARD_ICON;
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var c2 = getMsgContent(div);
            if (btn.classList.contains('saved')) {
                askRemove(c2.q).then(function (yes) {
                    if (!yes) return;
                    if (removeCard(c2.q, c2.ans)) {
                        btn.classList.remove('saved');
                        btn.title = '存成一张卡片';
                        toast('已从「我的卡片」移出');
                    }
                });
            } else {
                askSave(c2.q, c2.ans).then(function (res) {
                    if (!res || !res.ok) return;
                    if (saveCard(res.question, res.answerHtml, true, res.subject, res.chapter, res.originalQuestion)) {
                        btn.classList.add('saved');
                        btn.title = '已存成卡片，点击可移出';
                        toast('已存进「我的卡片」');
                    }
                });
            }
        });
        wrap.appendChild(btn);
    }

    /* ---------------- 挂到聊天窗上 ---------------- */
    function install() {
        var panel = document.getElementById('aiPanel');
        if (!panel) return false;
        injectCss();

        /* 1) 顶部入口按钮 */
        var headR = panel.querySelector('.ai-head-r');
        if (headR && !headR.querySelector('.mycards-entry')) {
            var entry = document.createElement('button');
            entry.type = 'button';
            entry.className = 'mycards-entry';
            entry.id = 'mycardsEntry';
            entry.title = '打开「我的卡片」';
            entry.innerHTML = CARD_ICON;
            entry.style.cssText = '';
            entry.addEventListener('click', function (e) {
                e.stopPropagation();
                if (OPEN_IN_NEW_TAB) window.open(MY_CARDS_URL, '_blank');
                else location.href = MY_CARDS_URL;
            });
            headR.insertBefore(entry, headR.firstChild);
        }

        /* 2) 每条 AI 回答右下角的存卡片按钮 */
        var msgs = panel.querySelector('#aiMsgs');
        if (msgs) {
            Array.prototype.forEach.call(msgs.querySelectorAll('.ai-msg.ai'), decorate);
            if (!msgs.__mycardsObserver) {
                var mo = new MutationObserver(function (muts) {
                    muts.forEach(function (mu) {
                        Array.prototype.forEach.call(mu.addedNodes, function (n) {
                            if (!n || n.nodeType !== 1) return;
                            if (n.classList && n.classList.contains('ai-msg')) decorate(n);
                            if (n.querySelectorAll) {
                                Array.prototype.forEach.call(n.querySelectorAll('.ai-msg.ai'), decorate);
                            }
                        });
                    });
                });
                mo.observe(msgs, { childList: true, subtree: true });
                msgs.__mycardsObserver = mo;
            }
        }
        return true;
    }

    function boot() {
        if (install()) return;
        var iv = setInterval(function () { if (install()) clearInterval(iv); }, 600);
        setTimeout(function () { clearInterval(iv); }, 30000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
