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

    function saveNow() {
        if (applying) return;
        var o = {};
        fields().forEach(function (f) { o[f.key] = f.el.value || ''; });
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
        key: KEY
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watch);
    } else {
        watch();
    }
})();
