/* ==========================================================================
   section-nav.js —— 八个板块的串连导航
   --------------------------------------------------------------------------
   作用：在子页顶栏「← 主页」右侧注入一颗 34px 圆钮（圆内是当前板块序号），
        点开向下弹出一个面板，列出八个板块任选，点击以「新开页面」方式打开。
        「我的卡片」页顶栏同构，按第 9 个位置参与（按钮写 9，面板仍是那八块）。

   设计定稿（26/10/16，当晚修订）：
     · 按钮   A2 —— 34px 正圆，底色 #c4e0c4（与「← 主页」「总卡」同族），无边无白
     · 数字   D1 —— 圆内写当前板块序号，18px / **700**
              （原来写的 500 是错的：Windows 的 Segoe UI 没有 500 字面，
               浏览器退回 400，所以看着始终是细的）
     · 位置   P2 —— 紧挨「← 主页」右侧
     · 面板   C3 —— 白底、浅底药丸 + 各板块实心色号方块，当前板块加描边
     · 锚点   宽屏 —— 面板顶边压在**按钮下沿正下方**（9px）；横向取
              「按钮圆心落在面板宽度 30% 处」（26/10/17 定为 B 方案）。
              若左缘对齐按钮，按钮只占 5%，整块往右铺，像挂在左上角；
              以 30% 为目标，按钮才是"坐在面板上方"。夹在顶栏卡片内不越界。
     · 锚点   窄屏（≤640，与页面断点一致）—— 顶栏竖堆成四行，从按钮下方弹出
              必然横切标题，所以改用**贴底抽屉 + 轻遮罩**，一次都不碰顶栏内容
     · 尺寸   自适应 —— 窄屏抽屉 / 宽屏 ×1.3，桌面不再显得小气
     · 补边   宽屏面板左右各外扩 13px，再把边缘"吸附"到最近的元素边界
              （最多挪 32px）：要么把下层那个字/图标整个盖住，要么干净让开，
              避免边缘正切在文字上、左右各露一条没遮到的细边。高度不动。
     · 列数   自适应 —— 宽屏按剩余空间自动选 4 / 3 / 2 列（先量后定）
     · 打开   真链接 <a target="_blank" rel="noopener">，不用 window.open
              （iOS 加到主屏后，前者才稳）

   自包含 IIFE：不写任何 window 全局，只往顶栏插入元素，不碰页面已有逻辑。
   ========================================================================== */
(function () {
    'use strict';

    /* 八个板块：dir 目录名 / short 面板里的两字简称 / name 全名（悬停提示）
       配色取自首页 index.html 的 MODULES 数组，一色未改 */
    var SECTIONS = [
        { n: 1, dir: '1micro-recitation',    short: '微背', name: '背诵（微观）',    c: '#3FAE8C', soft: '#EAF8F2' },
        { n: 2, dir: '2macro-recitation',    short: '宏背', name: '背诵（宏观）',    c: '#5A96DE', soft: '#EAF2FD' },
        { n: 3, dir: '3calc-keypoints',      short: '计要', name: '计算要点',        c: '#D0A44E', soft: '#FDF7E9' },
        { n: 4, dir: '4calc-special',        short: '计专', name: '计算专项',        c: '#D9739F', soft: '#FCEFF5' },
        { n: 5, dir: '5micro-short-answer',  short: '简微', name: '简答专项（微观）', c: '#3FAFC2', soft: '#E9F7F9' },
        { n: 6, dir: '6macro-short-answer',  short: '简宏', name: '简答专项（宏观）', c: '#7E70D6', soft: '#F1EFFC' },
        { n: 7, dir: '7essay',               short: '论述', name: '论述专项',        c: '#E0785A', soft: '#FDF1EC' },
        { n: 8, dir: '8past-exams',          short: '真题', name: '历年真题',        c: '#9B6BC4', soft: '#F7EFFB' }
    ];

    var BTN_SIZE = 34;          /* 圆钮直径，与顶栏其他圆钮一致 */
    var BTN_FONT = 18;          /* 序号字号（D1 放大加粗） */
    var BTN_WEIGHT = 700;       /* 必须用 700：500 在 Windows 上会退回 400，等于没加粗 */
    var SAFE_GAP = 12;          /* 面板右缘与视口之间至少留的余量 */
    var PANEL_GAP = 9;          /* 面板顶边与按钮下沿之间的距离 */
    var EDGE_PAD = 13;          /* 宽屏面板左右各外扩的像素（盖住下层元素露出的细边） */
    var EDGE_SNAP = 32;         /* 边缘若切在窄元素中间，最多再补这么多把它整个盖住 */
    var EDGE_SMALL = 140;       /* 只对这么小的元素做"别切一半"的处理（图标、字、小药丸） */
    var lastH = 0;              /* 最近一次量到的面板高度（面板隐藏时量不到） */
    var NARROW_MAX = 640;       /* 与页面自身断点一致：≤640 顶栏竖堆，改走底部抽屉 */

    /* ---------- ① 认当前板块：不在八个板块里就不装 ---------- */
    var path = location.pathname.replace(/\\/g, '/');
    var current = null;
    for (var i = 0; i < SECTIONS.length; i++) {
        if (path.indexOf('/' + SECTIONS[i].dir + '/') !== -1) { current = SECTIONS[i]; break; }
    }
    /* 「我的卡片」顶栏与八页同构，但不在板块序列里，按第 9 个位置参与：
       按钮写 9，面板仍旧只列那八块 —— 它自己不出现在面板里，所以没有"当前项"高亮 */
    if (!current && path.indexOf('/9my-cards/') !== -1) {
        current = { n: 9, dir: '9my-cards', short: '卡片', name: '我的卡片' };
    }
    if (!current) return;

    /* ---------- ② 注入样式 ---------- */
    var css = [
        /* 尺寸体系：所有尺寸乘 --secnav-s；窄屏 1.0，宽屏 1.25（见末尾媒体查询） */
        '.secnav-wrap{display:inline-flex;align-items:center;flex:0 0 auto}',
        '.secnav-btn{width:' + BTN_SIZE + 'px;height:' + BTN_SIZE + 'px;border-radius:50%;',
        'background:#c4e0c4;border:0;padding:0;margin:0;cursor:pointer;flex:0 0 auto;',
        'display:inline-flex;align-items:center;justify-content:center;',
        'font-family:inherit;font-size:' + BTN_FONT + 'px;font-weight:' + BTN_WEIGHT + ';line-height:1;',
        'color:#1e4a2a;transition:background .18s ease,transform .18s ease}',
        '.secnav-btn:hover{background:#a8d0a8}',
        '.secnav-btn[aria-expanded="true"]{background:#a8d0a8}',
        '.secnav-btn:active{transform:scale(.94)}',
        '.secnav-btn:focus-visible{outline:2px solid #3FAE8C;outline-offset:2px}',

        /* 面板：绝对定位在 .app-header 内，left / top 由 place() 按按钮算出来 */
        '.secnav-panel{--secnav-s:1;position:absolute;left:0;top:0;z-index:60;box-sizing:border-box;',
        'background:linear-gradient(180deg,#ffffff 0%,#fbfdfb 100%);',
        'border:1px solid #e0ece0;border-radius:calc(12px * var(--secnav-s));',
        'padding:calc(7px * var(--secnav-s));display:grid;gap:calc(5px * var(--secnav-s));',
        'box-shadow:0 1px 2px rgba(60,110,60,.06),0 10px 28px rgba(60,110,60,.20),',
        '0 2px 0 rgba(255,255,255,.9) inset;',
        'transform-origin:0 0;animation:secnavIn .22s cubic-bezier(.32,1.45,.52,1)}',
        '.secnav-panel[hidden]{display:none}',
        '@keyframes secnavIn{from{opacity:0;transform:translateY(-8px) scale(.9)}',
        'to{opacity:1;transform:none}}',
        '.secnav-panel::before{content:"";position:absolute;top:calc(-5px * var(--secnav-s));',
        'left:var(--secnav-arrow,calc(11px * var(--secnav-s)));',
        'width:calc(9px * var(--secnav-s));height:calc(9px * var(--secnav-s));',
        'background:#fff;border-left:1px solid #e0ece0;border-top:1px solid #e0ece0;transform:rotate(45deg)}',

        '.secnav-item{display:flex;align-items:center;gap:calc(6px * var(--secnav-s));',
        'padding:calc(5px * var(--secnav-s)) calc(9px * var(--secnav-s));',
        'border-radius:calc(8px * var(--secnav-s));text-decoration:none;white-space:nowrap;',
        'font-size:calc(11px * var(--secnav-s));color:#1e3a2a;box-sizing:border-box;',
        'transition:filter .15s ease}',
        '.secnav-item:hover{filter:brightness(.96)}',
        '.secnav-item.is-current{outline:1px solid var(--secnav-cur,#3FAE8C);outline-offset:-1px}',
        '.secnav-num{width:calc(15px * var(--secnav-s));height:calc(15px * var(--secnav-s));',
        'border-radius:calc(5px * var(--secnav-s));color:#fff;font-size:calc(10px * var(--secnav-s));',
        'font-style:normal;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}',

        /* 遮罩：只在窄屏配合底部抽屉出现，宽屏隐藏 */
        '.secnav-scrim{position:fixed;inset:0;z-index:55;background:rgba(30,74,42,.18);',
        'opacity:0;pointer-events:none;transition:opacity .22s ease}',
        '.secnav-scrim.is-open{opacity:1;pointer-events:auto}',

        /* 窄屏（≤640，与页面自己的断点一致）：顶栏竖堆成四行，
           从按钮下方弹出必然横切标题 —— 改成贴底抽屉，一次都不碰顶栏内容 */
        '@media (max-width:640px){',
        '.secnav-scrim{display:block;z-index:940}',
        '.secnav-panel{position:fixed;left:12px;right:12px;bottom:12px;top:auto;z-index:945;',
        'grid-template-columns:repeat(auto-fit,minmax(74px,1fr));gap:7px;padding:9px;border-radius:16px;',
        'box-shadow:0 2px 6px rgba(30,74,42,.10),0 16px 40px rgba(30,74,42,.26);',
        'animation:secnavUp .22s cubic-bezier(.32,1.45,.52,1)}',
        '.secnav-panel::before{display:none}',
        '.secnav-item{justify-content:center;padding:10px 6px;font-size:12px;border-radius:10px}',
        '.secnav-num{width:17px;height:17px;font-size:11px;border-radius:6px}',
        '}',
        '@media (min-width:641px){.secnav-scrim{display:none}.secnav-panel{--secnav-s:1.3}}',
        '@keyframes secnavUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}',
        '@media (prefers-reduced-motion:reduce){.secnav-panel{animation:none}}'
    ].join('');

    var style = document.createElement('style');
    style.id = 'secnav-style';
    style.textContent = css;
    document.head.appendChild(style);

    /* ---------- ③ 建按钮与面板 ---------- */
    var wrap = document.createElement('span');
    wrap.className = 'secnav-wrap';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secnav-btn';
    btn.textContent = String(current.n);
    btn.title = '切换板块';
    btn.setAttribute('aria-label', '切换板块，当前为第 ' + current.n + ' 个：' + current.name);
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');

    var panel = document.createElement('div');
    panel.className = 'secnav-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'menu');
    panel.style.setProperty('--secnav-cur', current.c || '#3FAE8C');

    /* 窄屏抽屉的轻遮罩（宽屏被 CSS 隐藏） */
    var scrim = document.createElement('div');
    scrim.className = 'secnav-scrim';

    SECTIONS.forEach(function (s) {
        var a = document.createElement('a');
        a.className = 'secnav-item' + (s === current ? ' is-current' : '');
        a.href = '../' + s.dir + '/index.html';
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = s.name;
        a.style.background = s.soft;
        if (s === current) a.setAttribute('aria-current', 'page');

        var num = document.createElement('i');
        num.className = 'secnav-num';
        num.style.background = s.c;
        num.textContent = String(s.n);

        var label = document.createElement('span');
        label.textContent = s.short;

        a.appendChild(num);
        a.appendChild(label);
        panel.appendChild(a);
    });

    wrap.appendChild(btn);

    /* ---------- ④ 挂载：按钮插进「← 主页」右侧；面板挂到顶栏卡片下缘 ---------- */
    var header = document.querySelector('.app-header');
    var host = header ? (header.querySelector('.header-left') || header) : null;
    if (!host) return;

    /* 面板要以顶栏卡片为定位基准（卡片本身是 static，补一个 relative） */
    if (getComputedStyle(header).position === 'static') header.style.position = 'relative';

    var back = host.querySelector('.back-home');
    if (back && back.parentNode === host) {
        host.insertBefore(wrap, back.nextSibling);
    } else {
        host.insertBefore(wrap, host.firstChild);
    }
    /* 面板不放在按钮里 —— 放按钮里就只能从按钮正下方弹，必切顶栏内容 */
    header.appendChild(panel);
    document.body.appendChild(scrim);

    /* ---------- ⑤ 定位 + 列数自适应：先量后定，不猜 ---------- */
    function isNarrow() { return window.innerWidth <= NARROW_MAX; }

    /* 宽屏：面板顶边压在按钮下沿正下方，横向让按钮大致"坐在面板上方"。
       若左缘对齐按钮左缘，按钮只占面板宽度的 5%，整块往右铺，看着像挂在左上角；
       所以取「按钮圆心落在面板宽度 30% 处」为目标（B 方案）。
       约束：面板不越出顶栏卡片，且按钮圆心必须落在面板内。 */
    function place(w) {
        var hr = header.getBoundingClientRect();
        var br = btn.getBoundingClientRect();
        var width = w || panel.offsetWidth || 0;
        var left = Math.round(br.left - hr.left);

        if (width > 0) {
            var center = br.left + br.width / 2 - hr.left;
            left = Math.round(Math.min(left, center - width * 0.3));
            /* 夹在卡片内（左右各留 8px）——面板左缘不能悬到卡片外面 */
            var maxLeft = Math.round(hr.width - width - 8);
            if (maxLeft < 0) maxLeft = 0;
            left = Math.max(0, Math.min(left, maxLeft));
        }

        /* 顶栏换行时（窄窗口），按钮下方会冒出统计药丸。
           面板若从按钮左缘展开，会把它切掉一半 —— 看着像故障。
           规则：只要下方有内容，就把面板左缘往左让到能把它整块盖住的位置，
           既不切一半，箭头也仍旧指着按钮。 */
        var belowLeft = leftmostBelow(br);
        if (belowLeft !== null && belowLeft < left) left = belowLeft;

        panel.style.left = left + 'px';
        panel.style.top = Math.round(br.bottom - hr.top + PANEL_GAP) + 'px';

        /* 箭头与入场动画都对准按钮圆心 */
        var cx = Math.round(br.left + br.width / 2 - hr.left - left);
        panel.style.transformOrigin = cx + 'px 0';
        panel.style.setProperty('--secnav-arrow', (cx - 5) + 'px');

        return hr.left + left;      /* 返回面板左缘在视口里的 x，给列数自适应用 */
    }

    /* 只改横向：把两边各自再外扩一点，箭头仍对准按钮圆心 */
    function setEdges(left, width) {
        var hr = header.getBoundingClientRect();
        var br = btn.getBoundingClientRect();
        left = Math.round(left);
        panel.style.left = left + 'px';
        panel.style.width = Math.round(width) + 'px';
        var cx = Math.round(br.left + br.width / 2 - hr.left - left);
        panel.style.transformOrigin = cx + 'px 0';
        panel.style.setProperty('--secnav-arrow', (cx - 5) + 'px');
    }

    /* 只有"会被看出切了一半"的元素才值得吸附：字、图标、小控件。
       整行容器 / 大面板被压住是浮层的正常样子，为它们挪边只会让面板白白变宽。 */
    function isEdgeSensitive(el, r) {
        var t = el.tagName;
        if (t === 'INPUT' || t === 'SELECT' || t === 'BUTTON' || t === 'LABEL' ||
            t === 'IMG' || t === 'A' || t === 'SPAN') return true;
        if (el.namespaceURI && el.namespaceURI.indexOf('svg') !== -1) return true;
        if (r.width <= EDGE_SMALL || r.height <= 26) return true;
        for (var i = 0; i < el.childNodes.length; i++) {
            var n = el.childNodes[i];
            if (n.nodeType === 3 && n.nodeValue && n.nodeValue.replace(/\s/g, '')) return true;
        }
        return false;
    }

    /* 面板某一条边缘正落在下层某个元素中间 —— 无论差几像素，都会露一条"没遮到"的边。
       做法：把边缘吸附到最近的元素边界，要么把那个元素整个盖住，要么干净地让开，
       哪个近用哪个，最多挪 EDGE_SNAP 像素。返回该边需要挪的像素（正 = 往右）。
       宽元素（输入框、整行容器）跨度大，两个边界都远，自然不会被吸过去。 */
    /* 自己或最近几层祖先被整体淡到看不见（AI 面板收起时就是这种） */
    function fadedOut(el) {
        var e = el, n = 0;
        while (e && e.nodeType === 1 && n++ < 6) {
            if (parseFloat(getComputedStyle(e).opacity) < 0.05) return true;
            e = e.parentElement;
        }
        return false;
    }

    function snapEdge(side, edge, topVp, h) {
        var best = 0;
        var bestD = EDGE_SNAP + 1;
        var all = document.body.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (el === panel || panel.contains(el) || el === wrap || wrap.contains(el)) continue;
            /* 隐藏层（比如收起后的 AI 面板，整块 opacity:0）不算 */
            if (el.checkVisibility && !el.checkVisibility()) continue;
            if (fadedOut(el)) continue;
            var r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) continue;
            if (!(r.left < edge - 0.5 && r.right > edge + 0.5)) continue;     /* 没横跨这条边 */
            if (!isEdgeSensitive(el, r)) continue;
            if (Math.min(r.bottom, topVp + h) - Math.max(r.top, topVp) <= 0.5) continue;
            var cands = [r.left - edge, r.right - edge];
            for (var k = 0; k < 2; k++) {
                var d = Math.abs(cands[k]);
                if (d > 0.5 && d < bestD) { bestD = d; best = cands[k]; }
            }
        }
        return Math.round(best);
    }

    /* 顶栏里位于按钮下沿以下、且不属于按钮自身 / 不属于面板自身的那些元素，
       取最靠左的坐标（相对顶栏）。返回 null 表示按钮下方什么都没有（单行顶栏，只有内边距）。
       必须排除面板自己的子孙：开着面板时缩放窗口，它们会被误判成"顶栏内容"。 */
    function leftmostBelow(br) {
        var min = null;
        var hl = header.getBoundingClientRect().left;
        var all = header.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (el === panel || panel.contains(el)) continue;
            if (el.contains(btn) || btn.contains(el)) continue;
            var r = el.getBoundingClientRect();
            if (r.height <= 0 || r.width <= 0) continue;
            if (r.top < br.bottom - 2) continue;       /* 与按钮同一行的不算 */
            var l = r.left - hl;
            if (min === null || l < min) min = l;
        }
        return min === null ? null : Math.round(min);
    }

    function applyCols() {
        panel.style.width = '';
        if (isNarrow()) {
            /* 窄屏：位置与列数全交给 CSS（贴底抽屉），清掉宽屏那套内联值 */
            panel.style.left = '';
            panel.style.top = '';
            panel.style.transformOrigin = '';
            panel.style.gridTemplateColumns = '';
            return;
        }
        /* 列数决定面板宽度，宽度又决定锚点，两者互相咬合：
           先按 4 列量宽、定锚点，若 4 列放不下再退 3 列，最后按定下的列数重算一次锚点。 */
        var cols = 4;
        var w = measure(4);
        var leftViewport = place(w);
        if (w > window.innerWidth - leftViewport - SAFE_GAP) {
            cols = 3;
            w = measure(3);
            leftViewport = place(w);
            if (w > window.innerWidth - leftViewport - SAFE_GAP) cols = 2;
        }
        panel.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';

        /* 左右各外扩 EDGE_PAD：面板边缘常正压在下层筛选栏的字上，
           只差几个像素露一条细边，看着像没遮干净。
           外扩后那些窄元素会被整块盖住；高度一点不动，所以不会压到下面的卡片。 */
        var baseW = measure(cols) || w;
        var out = baseW + EDGE_PAD * 2;
        panel.style.width = out + 'px';
        var leftVp = place(out);

        /* 外扩后若边缘仍压在某个元素中间，就吸附到最近的元素边界：盖住或让开，取近的 */
        if (lastH > 0) {
            var hr2 = header.getBoundingClientRect();
            var l0 = parseFloat(panel.style.left) || 0;
            var topVp = hr2.top + (parseFloat(panel.style.top) || 0);
            var dL = snapEdge('l', hr2.left + l0, topVp, lastH);
            var dR = snapEdge('r', hr2.left + l0 + out, topVp, lastH);
            var nl = l0 + dL;
            var nw = out + (dR - dL);
            /* 别吸得太窄、别顶出卡片、别顶出视口，也别把按钮挤到面板边上 */
            var btnCenterOff = btn.getBoundingClientRect().left + btn.offsetWidth / 2 - hr2.left;
            if (nw >= baseW * 0.88 && nl >= 0 && nl + nw <= hr2.width - 8 &&
                nl <= btnCenterOff - 40 &&
                hr2.left + nl + nw <= window.innerWidth - SAFE_GAP) {
                setEdges(nl, nw);
            }
        }
    }

    /* 临时量一次宽度：面板是绝对定位，拿出来量不会挤动页面。
       用 offsetWidth 而不是 getBoundingClientRect —— rect 会被入场动画的 scale 缩放，
       量出来会偏小（之前 357 的面板量成 321 就是这个原因）。 */
    function measure(n) {
        var wasHidden = panel.hidden;
        panel.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
        if (wasHidden) {
            panel.hidden = false;
            panel.style.visibility = 'hidden';
        }
        var w = panel.offsetWidth;
        lastH = panel.offsetHeight || lastH;
        if (wasHidden) {
            panel.hidden = true;
            panel.style.visibility = '';
        }
        return w;
    }

    /* ---------- ⑥ 开合 ---------- */
    function open() {
        applyCols();
        panel.hidden = false;
        scrim.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
    }
    function close() {
        panel.hidden = true;
        scrim.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (panel.hidden) { open(); } else { close(); }
    });

    /* 选中任一项即收起（不拦截默认行为，新页面照常打开） */
    panel.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('.secnav-item')) close();
    });

    document.addEventListener('click', function (e) {
        if (panel.hidden) return;
        if (wrap.contains(e.target) || panel.contains(e.target)) return;
        close();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !panel.hidden) { close(); btn.focus(); }
    });

    var rt = null;
    window.addEventListener('resize', function () {
        if (rt) clearTimeout(rt);
        rt = setTimeout(applyCols, 120);
    });
})();
