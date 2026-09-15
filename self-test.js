/* ============================================================
   自测模式（独立模块）
   - 默认关闭，关闭时对原有页面零影响
   - 数据存 <模块前缀>selftest，自动随「学习数据」导出
   ============================================================ */
(function () {
    'use strict';

    /* ---------- 定位当前子页的存储前缀（与主页导出的 MODULE_PREFIXES 一致） ---------- */
    var PREFIX_MAP = {
        '1micro-recitation':   'micro_recite_',
        '2macro-recitation':   'macro_recite_',
        '3calc-keypoints':     'calc_key_',
        '4calc-special':       'calc_special_',
        '5micro-short-answer': 'micro_short_',
        '6macro-short-answer': 'macro_short_',
        '7essay':              'essay_',
        '8past-exams':         'past_exams_'
    };
    var segs = location.pathname.split('/').filter(Boolean);
    var DIR = segs.length ? (/\.html?$/.test(segs[segs.length - 1]) ? (segs[segs.length - 2] || '') : segs[segs.length - 1]) : '';
    var PREFIX = PREFIX_MAP[DIR];
    var KEY = PREFIX ? (PREFIX + 'selftest') : null;

    var grid = document.getElementById('cardGrid');
    if (!KEY || !grid) return;                 // 未匹配到的页面直接不启用

    /* 真题页没有答案区（只有作答区），走「错题本」模式：不遮答案、不拦点击 */
    var HAS_ANSWER = (DIR !== '8past-exams');
    var MODE_LABEL = HAS_ANSWER ? '自测模式' : '错题本';

    /* ---------- 状态 ---------- */
    var ON = false;
    var marks = load();          // { 卡片id: 'ok' | 'meh' | 'no' }
    var revealed = {};           // 运行时：该卡答案是否已揭晓
    var filter = 'all';
    var openBefore = [];         // 进入自测前已展开的卡片，退出时还原

    function load() {
        try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(marks)); }
        catch (e) {
            var full = !!(e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014));
            var msg = full ? '⚠️ 存储空间不足，自测标记没能保存' : '⚠️ 自测标记保存失败';
            try { if (typeof showToast === 'function') { showToast(msg); return; } } catch (x) {}
            alert(msg);
        }
    }

    /* ---------- 样式 ---------- */
    var style = document.createElement('style');
    style.textContent = [
        /* 开关：放在大标题右侧 */
        '.st-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;margin-left:4px;}',
        '.st-switch input{display:none;}',
        '.st-track{width:46px;height:26px;border-radius:20px;background:#d8e6d8;position:relative;transition:background .25s;flex:0 0 auto;}',
        '.st-track::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18);transition:transform .25s;}',
        '.st-switch input:checked + .st-track{background:#5ec99a;}',
        '.st-switch input:checked + .st-track::after{transform:translateX(20px);}',
        '.st-switch .st-lbl{font-size:13.5px;font-weight:600;color:#3d6b46;}',
        /* 统计条：卡片区上方独立一行，仅自测模式显示 */
        /* 宽度/居中在运行时从 .card-grid 拷贝，保证左边缘与卡片对齐（各页宽度可能不同） */
        '.st-stats-bar{display:none;gap:8px;flex-wrap:wrap;align-items:center;margin:0 auto 12px auto;}',
        'body.st-on .st-stats-bar{display:flex;}',
        '.st-chip{background:#fff;border:1px solid #e6f0e6;border-radius:12px;padding:6px 13px;font-size:12.5px;box-shadow:0 2px 8px rgba(60,100,60,.07);cursor:pointer;user-select:none;transition:all .18s;}',
        '.st-chip:hover{border-color:#9ccfae;transform:translateY(-1px);}',
        '.st-chip.sel{border-color:#5ec99a;background:#eefaf3;box-shadow:0 0 0 2px rgba(94,201,154,.18);}',
        '.st-chip b{font-size:14px;margin-left:4px;}',
        '.st-chip.c-ok b{color:#2b7a2b;}',
        '.st-chip.c-meh b{color:#c98a2b;}',
        '.st-chip.c-no b{color:#b85050;}',
        '.st-chip.c-weak b{color:#b85050;}',
        '.st-chip.c-left b{color:#5f7f8f;}',
        /* 卡片 */
        /* 有答案的页面才隐藏「点击展开答案」提示；真题页要保留「点击展开作答区」 */
        (HAS_ANSWER ? 'body.st-on .toggle-hint{display:none;}' : ''),
        (HAS_ANSWER ? 'body.st-on .card-question{cursor:default;}' : ''),
        '.card-item.st-hide{display:none !important;}',
        '.card-item.st-ok{border-left-color:#5ec99a;}',
        '.card-item.st-meh{border-left-color:#e0b152;}',
        '.card-item.st-no{border-left-color:#cf6b6b;}',
        /* 遮罩本身不可点，避免手机误触；揭晓只能走按钮 */
        '.st-mask{position:relative;cursor:default;border-radius:14px;overflow:hidden;}',
        '.st-mask .answer-inner{filter:blur(6px);user-select:none;pointer-events:none;}',
        '.st-cover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:8px;background:rgba(243,250,243,.62);color:#4f7a5e;font-size:13.5px;font-weight:500;border:1.5px dashed #b3ddc3;border-radius:14px;}',
        /* 自评按钮：无图标，靠色彩与字重区分状态 */
        '.st-rate{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:0 22px 16px 22px;}',
        '.st-rate button{font-family:inherit;border:1.5px solid #e2ece5;background:#fff;color:#5f8569;border-radius:10px;padding:7px 18px;font-size:13.5px;font-weight:500;line-height:1.4;cursor:pointer;letter-spacing:.3px;transition:background .18s,border-color .18s,color .18s,box-shadow .18s;}',
        /* 字前圆点：未选中淡色，选中后转为饱和色 */
        '.st-rate .st-b-ok::before,.st-rate .st-b-meh::before,.st-rate .st-b-no::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:7px;vertical-align:1px;transition:background .18s;}',
        '.st-rate .st-b-ok::before{background:#a8dcc2;}',
        '.st-rate .st-b-meh::before{background:#e6cd97;}',
        '.st-rate .st-b-no::before{background:#e8b2b2;}',
        '.st-rate .st-b-ok.sel::before{background:#3fa87a;}',
        '.st-rate .st-b-meh.sel::before{background:#d99b2b;}',
        '.st-rate .st-b-no.sel::before{background:#c85656;}',
        '.st-rate .st-b-ok:hover{background:#eef8f2;border-color:#a8dcc2;color:#2f7d55;}',
        '.st-rate .st-b-meh:hover{background:#fdf6e9;border-color:#e6cd97;color:#9a7326;}',
        '.st-rate .st-b-no:hover{background:#fdeeee;border-color:#e8b2b2;color:#a85050;}',
        '.st-rate .st-b-ok.sel{background:#e6f6ed;border-color:#5ec99a;color:#237a4c;font-weight:600;box-shadow:0 1px 5px rgba(94,201,154,.22);}',
        '.st-rate .st-b-meh.sel{background:#fbf1de;border-color:#dfae4e;color:#8a6420;font-weight:600;box-shadow:0 1px 5px rgba(223,174,78,.22);}',
        '.st-rate .st-b-no.sel{background:#fbe9e9;border-color:#d98a8a;color:#9c4444;font-weight:600;box-shadow:0 1px 5px rgba(217,138,138,.22);}',
        '.st-rate .st-b-view{margin-left:auto;border-color:#d8ebdf;background:#fff;color:#4a7a58;padding:7px 16px;}',
        '.st-rate .st-b-view:hover{background:#eefaf3;border-color:#8ed0ae;color:#2b6b46;}',
        '@media (max-width:640px){.st-rate{padding:0 16px 14px 16px;gap:7px;}.st-rate button{padding:7px 14px;}.st-rate .st-b-view{margin-left:0;}}'
    ].join('\n');
    document.head.appendChild(style);

    /* ---------- 开关：放进大标题右侧 ---------- */
    var SWITCH_HTML =
        '<label class="st-switch" title="' + (HAS_ANSWER ? '自测模式：先默背，再看答案，然后自评' : '错题本：给真题做掌握度标记') + '">' +
          '<input type="checkbox" id="stToggle">' +
          '<span class="st-track"></span>' +
          '<span class="st-lbl">' + MODE_LABEL + '</span>' +
        '</label>';

    var headerLeft = document.querySelector('.app-header .header-left');
    if (headerLeft) headerLeft.insertAdjacentHTML('beforeend', SWITCH_HTML);

    /* ---------- 统计条：卡片区上方独立一行 ---------- */
    var statsBar = document.createElement('div');
    statsBar.className = 'st-stats-bar';
    statsBar.innerHTML =
          '<div class="st-chip sel" data-f="all">全部<b id="stAll">0</b></div>' +
          '<div class="st-chip c-weak" data-f="weak">只看不会的<b id="stWeak">0</b></div>' +
          '<div class="st-chip c-ok" data-f="ok">会了<b id="stOk">0</b></div>' +
          '<div class="st-chip c-meh" data-f="meh">模糊<b id="stMeh">0</b></div>' +
          '<div class="st-chip c-no" data-f="no">忘了<b id="stNo">0</b></div>' +
          '<div class="st-chip c-left" data-f="none">未测<b id="stLeft">0</b></div>';
    grid.parentNode.insertBefore(statsBar, grid);

    var toggle = document.getElementById('stToggle');
    if (!toggle) return;

    /* ---------- 工具 ---------- */
    function allCards() { return Array.prototype.slice.call(grid.querySelectorAll('.card-item')); }
    function cardId(el) { return el.getAttribute('data-id'); }

    /* ---------- 遮罩 ---------- */
    function applyMask(card) {
        var id = cardId(card);
        var ans = card.querySelector('.card-answer');
        if (!ans) return;
        var inner = ans.querySelector('.answer-inner');
        var mask = ans.querySelector('.st-mask');

        if (ON && !revealed[id]) {
            if (!mask && inner) {
                mask = document.createElement('div');
                mask.className = 'st-mask';
                mask.innerHTML = '<div class="st-cover">答案已遮住</div>';
                ans.insertBefore(mask, inner);
                mask.appendChild(inner);
            }
        } else if (mask && inner) {
            ans.appendChild(inner);
            mask.remove();
        }
    }

    /* ---------- 自评按钮 ---------- */
    function ensureRate(card) {
        if (card.querySelector('.st-rate')) return;
        var id = cardId(card);
        var ans = card.querySelector('.card-answer');
        var rate = document.createElement('div');
        rate.className = 'st-rate';
        rate.setAttribute('data-id', id);
        rate.innerHTML =
            '<button class="st-b-ok">会了</button>' +
            '<button class="st-b-meh">模糊</button>' +
            '<button class="st-b-no">忘了</button>' +
            '<button class="st-b-view">查看答案</button>';
        // 有答案区就放在答案下面；真题页没有答案区，放在题目下面
        var anchor = ans || card.querySelector('.card-question');
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(rate, anchor.nextSibling);
        else card.appendChild(rate);

        rate.querySelector('.st-b-ok').addEventListener('click', function () { mark(id, 'ok'); });
        rate.querySelector('.st-b-meh').addEventListener('click', function () { mark(id, 'meh'); });
        rate.querySelector('.st-b-no').addEventListener('click', function () { mark(id, 'no'); });
        rate.querySelector('.st-b-view').addEventListener('click', function () {
            revealed[id] = !revealed[id];
            applyMask(card);
            refreshCard(card);
            window.__stFocusId = id; // 告知 AI：这张是当前正在看/刚揭晓的卡片
        });
    }

    function removeRate(card) {
        var r = card.querySelector('.st-rate');
        if (r) r.remove();
    }

    function mark(id, level) {
        if (marks[id] === level) delete marks[id];   // 再点一次 = 清除
        else marks[id] = level;
        revealed[id] = !!marks[id];
        window.__stFocusId = id; // 告知 AI：这张是当前正在自评的卡片
        save();
        applyAll();
    }

    /* ---------- 单卡刷新 ---------- */
    function refreshCard(card) {
        var id = cardId(card);
        var m = marks[id];
        card.classList.remove('st-ok', 'st-meh', 'st-no', 'st-hide');

        // 只在自测模式开启时染色 / 筛选；关闭时卡片外观与原本完全一致
        if (!ON) return;

        if (m) card.classList.add('st-' + m);

        var show = true;
        if (filter === 'ok')   show = m === 'ok';
        if (filter === 'meh')  show = m === 'meh';
        if (filter === 'no')   show = m === 'no';
        if (filter === 'weak') show = (m === 'meh' || m === 'no');
        if (filter === 'none') show = !m;
        if (!show) card.classList.add('st-hide');

        var rate = card.querySelector('.st-rate');
        if (rate) {
            rate.querySelectorAll('button').forEach(function (b) { b.classList.remove('sel'); });
            if (m) {
                var sel = rate.querySelector('.st-b-' + m);
                if (sel) sel.classList.add('sel');
            }
            // 查看答案 / 重新遮住 同一个按钮，按状态切换文案；真题页无答案则隐藏
            var vb = rate.querySelector('.st-b-view');
            if (vb) {
                if (HAS_ANSWER) {
                    vb.style.display = '';
                    vb.textContent = revealed[id] ? '重新遮住' : '查看答案';
                } else {
                    vb.style.display = 'none';
                }
            }
        }
    }

    /* ---------- 全量应用 ---------- */
    /* 统计条宽度跟随卡片区（各页 max-width 不同，运行时读取最稳） */
    function syncWidth() {
        try {
            var cs = window.getComputedStyle(grid);
            statsBar.style.maxWidth = (cs && cs.maxWidth && cs.maxWidth !== 'none') ? cs.maxWidth : '';
        } catch (e) {}
    }
    window.addEventListener('resize', syncWidth);

    function applyAll() {
        var cards = allCards();
        syncWidth();
        cards.forEach(function (c) {
            var a = c.querySelector('.card-answer');
            if (ON) {
                ensureRate(c);
                if (a && HAS_ANSWER) a.classList.add('open');   // 展开并遮住（真题页无答案区则跳过）
            } else {
                removeRate(c);
                if (a) a.classList.toggle('open', openBefore.indexOf(cardId(c)) >= 0);
            }
            applyMask(c);
            refreshCard(c);
        });
        updateStats(cards);
    }

    function updateStats(cards) {
        var ok = 0, meh = 0, no = 0, none = 0;
        cards.forEach(function (c) {
            var m = marks[cardId(c)];
            if (m === 'ok') ok++;
            else if (m === 'meh') meh++;
            else if (m === 'no') no++;
            else none++;
        });
        document.getElementById('stAll').textContent  = cards.length;
        document.getElementById('stOk').textContent   = ok;
        document.getElementById('stMeh').textContent  = meh;
        document.getElementById('stNo').textContent   = no;
        document.getElementById('stWeak').textContent = meh + no;
        document.getElementById('stLeft').textContent = none;
    }

    /* ---------- 开关 ---------- */
    toggle.addEventListener('change', function () {
        ON = toggle.checked;
        window.__selfTestOn = ON;                 // AI 据此不读答案
        window.__stFocusId = null;               // 切换开关时重置焦点标记
        document.body.classList.toggle('st-on', ON);

        if (ON) {
            // 记住进入前展开的卡片，退出时还原
            openBefore = allCards()
                .filter(function (c) { var a = c.querySelector('.card-answer'); return a && a.classList.contains('open'); })
                .map(cardId);
            revealed = {};
        } else {
            revealed = {};
        }
        applyAll();
        if (!ON) openBefore = [];
    });

    /* ---------- 统计条筛选 ---------- */
    statsBar.addEventListener('click', function (e) {
        var chip = e.target.closest ? e.target.closest('.st-chip') : null;
        if (!chip) return;
        statsBar.querySelectorAll('.st-chip').forEach(function (s) { s.classList.remove('sel'); });
        chip.classList.add('sel');
        filter = chip.getAttribute('data-f');
        applyAll();
    });

    /* ---------- 拦截「点题目展开答案」：自测时改为揭晓遮罩 ---------- */
    document.addEventListener('click', function (e) {
        if (!ON || !HAS_ANSWER) return;      // 真题页不拦，保证「作答区」能正常展开
        var q = e.target && e.target.closest ? e.target.closest('.card-question') : null;
        if (!q) return;
        if (q.classList.contains('editable')) return;
        // 只阻止「点题目收起答案」，不自动揭晓——揭晓统一走「查看答案」按钮
        e.stopPropagation();
        e.preventDefault();
        var _c = q.closest('.card-item');
        if (_c) window.__stFocusId = _c.getAttribute('data-id'); // 点题目即视为正在看这张
    }, true);

    /* ---------- 卡片重渲染（搜索/筛选）后重新套用 ---------- */
    var moTimer = null;
    if (window.MutationObserver) {
        new MutationObserver(function () {
            clearTimeout(moTimer);
            moTimer = setTimeout(function () { applyAll(); }, 60);
        }).observe(grid, { childList: true });
    }

    applyAll();
})();
