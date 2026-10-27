/* ============================================================================
   filter-memory.js  ——  记住筛选栏，刷新后原样还原
   ----------------------------------------------------------------------------
   存什么：
     #filterBar 里每个 select 的 value（按 select 的 id 分别存）+ #filterSearch 的关键词

   怎么接（两步，各页一样）：
     1. 在页面 <head> 末尾加：
            <script src="../shared/filter-memory.js"></script>
     2. 在页面脚本「首次 render()」之前加：
            if (window.FilterMemory) FilterMemory.apply();

   级联下拉（专业→套卷、专项→细分）再多一步：
     在 apply() 之前把「按上级重建下级」的函数交出来：
            if (window.FilterMemory) FilterMemory.cascade = updatePaperOptions;
     否则恢复上级专业后，下级套卷列表还是「全部专业」时建的旧列表，
     会出现「专业选了应用经济学，套卷里却还列着理论/金融」。

   为什么必须在首次 render 之前还原：
     否则页面会先画一遍全量卡片、再变成筛选结果，8past-exams 那 466 张卡能看出跳动。
     现在先改下拉的值再 render，只画一遍。

   存哪儿：
     <页面前缀>filters，例如 micro_recite_filters
     值形如 {"filterSpecial":"第3章|简答","filterFav":"fav","filterSearch":"弹性"}

   暂停接口（给全站搜索跳转用，26/10/27 加）：
     suspend() 期间不写存储，resume() 恢复；snapshot() 取原件，restore(raw) 原样写回
     （raw 传 null 表示这个键本来不存在）。全站搜索带 ?kw= 进来时会往 #filterSearch
     填临时词，不暂停就会被当成你的筛选记下来；退出搜索时要把它还原成进来之前的样子。
     freezeText() / unfreezeText() 只冻结 #filterSearch 一项，下拉照常记：
     搜索会话里改的章节是真筛选，该记；框里的临时词不该记。
     冻结时存下去的是原件里那个词，不是框里当前的词。

   兜底：
     · 章节改名/删除后，存的值在下拉里找不到 → 忽略该项，自动回落「全部」
     · 隐私模式 / 存储配额满 → 静默降级，页面照常用，只是不记
   ========================================================================== */
(function () {
    'use strict';

    /* ---------- 定位当前子页的存储前缀（与 self-test.js / 主页导出一致） ---------- */
    var PREFIX_MAP = {
        '1micro-recitation':   'micro_recite_',
        '2macro-recitation':   'macro_recite_',
        '3calc-keypoints':     'calc_key_',
        '4calc-special':       'calc_special_',
        '5micro-short-answer': 'micro_short_',
        '6macro-short-answer': 'macro_short_',
        '7essay':              'essay_',
        '8past-exams':         'past_exams_',
        '9my-cards':           'mycards_'       // 卡片页单独一套，不与子页混
    };
    var segs = location.pathname.split('/').filter(Boolean);
    var DIR = segs.length ? (/\.html?$/.test(segs[segs.length - 1]) ? (segs[segs.length - 2] || '') : segs[segs.length - 1]) : '';
    var PREFIX = PREFIX_MAP[DIR];
    if (!PREFIX) return;                        // 没匹配到的页面（如首页）不启用

    var KEY = PREFIX + 'filters';
    var TEXT_KEY = 'filterSearch';

    /* ---------- 读写 ---------- */
    function load() {
        try {
            var o = JSON.parse(localStorage.getItem(KEY) || '{}');
            return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
        } catch (e) { return {}; }
    }
    var saved = load();
    var applying = false;                       // 还原过程中不触发记录，避免把中间态写回去
    var paused = false;                         // 外部临时停记（全站搜索跳转时用，见文件头「暂停」）
    var textFrozen = false;                     // 只冻结搜索框这一项，下拉照常记

    function saveNow() {
        if (applying || paused) return;
        var o = {};
        fields().forEach(function (f) {
            /* 冻结期间搜索框里的词是临时借用的，不写进记忆；
               记忆里原本那个词在下面原样补回，等于这次改动没碰过它 */
            if (textFrozen && f.kind === 'text') return;
            o[f.key] = f.el.value || '';
        });
        if (textFrozen && Object.prototype.hasOwnProperty.call(saved, TEXT_KEY)) {
            o[TEXT_KEY] = saved[TEXT_KEY];
        }
        try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    }

    /* ---------- 收集筛选控件（按 DOM 顺序，级联下拉的前置项先还原） ---------- */
    function fields() {
        var bar = document.getElementById('filterBar');
        if (!bar) return [];
        var out = [];
        Array.prototype.forEach.call(bar.querySelectorAll('select'), function (s) {
            if (s.id) out.push({ el: s, key: s.id, kind: 'select' });
        });
        var search = document.getElementById(TEXT_KEY);
        if (search) out.push({ el: search, key: TEXT_KEY, kind: 'text' });
        return out;
    }

    function optionExists(sel, v) {
        for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === v) return true;
        }
        return false;
    }

    /* ---------- 还原（在首次 render 之前调用） ---------- */
    function apply() {
        var list = fields();
        var changed = false, dirty = false;
        var needCascade = false;    // 上一个下拉改过值 → 下级选项还是旧的，需要重建
        var cascadeDone = false;    // 重建只做一次：重建会把下级打回「全部」，做第二次就白填了
        /* 页面注册的「按上级重建下级选项」函数（见文件头「级联下拉」说明） */
        var cascade = (window.FilterMemory && typeof window.FilterMemory.cascade === 'function')
            ? window.FilterMemory.cascade : null;

        applying = true;

        /* 第一轮：能设的直接设 */
        list.forEach(function (f) {
            /* 级联：上级的值刚被改动，下级的选项还是旧的（甚至还是全量），
               先让页面按新上级重建一次，再填下级；否则会出现
               「专业=应用经济学，套卷里却还列着理论/金融」。 */
            if (f.kind === 'select' && needCascade && !cascadeDone) {
                if (typeof cascade === 'function') {
                    try { cascade(); } catch (e) {}
                }
                cascadeDone = true;
                needCascade = false;
            }

            if (!Object.prototype.hasOwnProperty.call(saved, f.key)) return;
            var v = saved[f.key];
            if (typeof v !== 'string') return;

            if (f.kind === 'text') {
                if (f.el.value !== v) { f.el.value = v; changed = true; }
                return;
            }
            if (!v || !optionExists(f.el, v)) return;   // 留到第二轮
            if (f.el.value !== v) {
                f.el.value = v; changed = true;
                needCascade = true;
            }
        });

        /* 第二轮：级联下拉（专项→细分、专业→套卷）的下级选项要等上级 change 才重建。
           只对「设不上」的下级补一次上级 change，普通页面不受影响。 */
        for (var i = 0; i < list.length; i++) {
            var f = list[i];
            if (f.kind !== 'select') continue;
            if (!Object.prototype.hasOwnProperty.call(saved, f.key)) continue;
            var v = saved[f.key];
            if (!v || optionExists(f.el, v)) continue;

            for (var j = i - 1; j >= 0; j--) {
                if (list[j].kind === 'select') {
                    list[j].el.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                }
            }
            if (optionExists(f.el, v)) { f.el.value = v; changed = true; }
            else { dirty = true; delete saved[f.key]; }
        }

        applying = false;

        /* 只把「清掉失效项」后的结果写回，绝不拿 DOM 当前值覆盖存储 ——
           万一级联重建把某一项打回默认，写回就等于把用户的记忆冲掉了。 */
        if (dirty) {
            try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
        }
        return changed;
    }

    /* ---------- 记录（用户改筛选时） ---------- */
    var timer = null;
    function watch() {
        var bar = document.getElementById('filterBar');
        if (!bar) return;

        /* 下拉：选完立刻记。直接绑在控件上，不走事件委托 ——
           委托要求事件冒泡，而程序化触发的 change 默认不冒泡，容易漏记。 */
        fields().forEach(function (f) {
            if (f.kind === 'text') {
                f.el.addEventListener('input', function () {
                    clearTimeout(timer);
                    timer = setTimeout(saveNow, 320);
                });
            } else {
                f.el.addEventListener('change', saveNow);
            }
        });

        /* 「重置筛选」是直接改 value、不发 change 的，点击后补存一次 */
        bar.addEventListener('click', function (e) {
            var t = e.target;
            if (t && t.closest && t.closest('#clearFilterBtn')) {
                setTimeout(saveNow, 0);
            }
        });
    }

    window.FilterMemory = {
        apply: apply,
        save: saveNow,
        key: KEY,
        /* 全站搜索跳转用：临时停记 / 恢复记录 */
        suspend: function () { paused = true; },
        resume: function () { paused = false; },
        /* 只冻结搜索框：整个搜索会话期间，框里的词都不进记忆。
           下拉不冻结 —— 从搜索进来后自己选的章节仍应算作他的筛选 */
        freezeText: function () { textFrozen = true; },
        unfreezeText: function () { textFrozen = false; },
        /* 原件（整串 JSON）：跳转进来时拍一张，退出时原样写回 */
        snapshot: function () {
            try { return localStorage.getItem(KEY); } catch (e) { return null; }
        },
        restore: function (raw) {
            try {
                if (raw === null || raw === undefined) localStorage.removeItem(KEY);
                else localStorage.setItem(KEY, raw);
            } catch (e) {}
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watch);
    } else {
        watch();
    }
})();
