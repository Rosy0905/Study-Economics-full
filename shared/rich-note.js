/* ============================================================================
   rich-note.js —— 子页「笔记区」轻量富文本工具栏（自包含，不改页面原有代码）
   ----------------------------------------------------------------------------
   用法：在子页 </body> 前加一行
        <script src="../shared/rich-note.js"></script>
   即会自动给页面里每个 .card-note-area 挂上工具栏：
        B I U | 🖼️ 图片  ▦ 表格  ∑ 行内式  ∑ 块级式 | 💾 保存  🗑️ 清空
   同时带来「我的卡片」里那套图片设定：像素宽尺寸条 + 确认压缩（真·重采样）+
   非编辑态点图开浮层预览（± 缩放 / 1:1 / 适应窗口）。
   26/09/20 第 13 轮
   ========================================================================= */
(function () {
    'use strict';

    if (window.__rteLoaded) return;
    window.__rteLoaded = true;

    /* ======================= A. KaTeX（本地 vendor，多路径兜底） ============ */
    (function loadKatex() {
        var BASES = ['../vendor/katex/', 'vendor/katex/', '../../vendor/katex/'];
        var i = 0;
        function next() {
            if (i >= BASES.length) return;
            var base = BASES[i++];
            var s = document.createElement('script');
            s.src = base + 'katex.min.js';
            s.onload = function () {
                var l = document.createElement('link');
                l.rel = 'stylesheet';
                l.href = base + 'katex.min.css';
                document.head.appendChild(l);
                window.__rteKatexReady = true;
                document.querySelectorAll('.note-editor').forEach(renderMathIn);
            };
            s.onerror = next;
            document.head.appendChild(s);
        }
        next();
    })();

    /* ======================= B. 样式（前缀 rte- 避免撞车） ================= */
    var CSS = [
        /* 26/09/20 第 17 轮：手机上点按钮残留的那块蓝色长方形，这次一次治到位。
           上一轮只关了 .rte-bar 按钮自己的 tap-highlight，没治干净，原因是三处会同时留印子：
           ① 浏览器的点击高亮（-webkit-tap-highlight-color）—— 它是**可继承**属性，
              只在按钮上设不够，写在 html/body 上才能顺着继承到页面里所有元素；
           ② 按钮被 focus 之后某些 WebView 会画焦点框（outline）；
           ③ :active 在触摸设备上会赖着不走。
           所以这里三条一起上：全局继承 + 所有可点元素显式关 + focus/active 只在有鼠标的设备生效。 */
        'html,body{-webkit-tap-highlight-color:transparent;}',
        'button,input,select,textarea,label,a,.rte-bar,.rte-imgctl,.rte-viewer-bar{',
        '-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;}',
        '.rte-bar button:focus,.rte-bar button:focus-visible,',
        '.rte-imgctl button:focus,.rte-imgctl button:focus-visible,',
        '.rte-viewer-bar button:focus,.rte-viewer-bar button:focus-visible,',
        '.rte-modal button:focus,.rte-modal button:focus-visible{outline:none;}',
        /* 工具栏整体 */
        '.rte-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;}',
        /* 26/09/20 第 13 轮：所有按钮统一 28px 高、用 flex 居中。
           以前 BIU 是 28px、带 emoji 的那几个是 26px，两行摆一起就上下错位 1~2px。 */
        '.rte-bar button{background:#dcebd9;border:none;padding:0 12px;border-radius:30px;',
        'height:28px;display:inline-flex;align-items:center;justify-content:center;',
        'font-size:12.5px;cursor:pointer;color:#1e4a2a;font-weight:500;font-family:inherit;',
        'transition:background .18s ease,box-shadow .18s ease,transform .12s ease;line-height:1;',
        /* 26/09/20 第 16 轮：手机上点按钮会留下一块蓝色长方形，要过 1 秒左右才褪。
           那是浏览器的「点击高亮」（-webkit-tap-highlight-color），跟我们的样式无关，
           点「表格」时因为紧接着弹出弹窗、视线正好停在按钮上，所以看得最明显。
           这里一并处理：关掉高亮 + 关掉双击缩放等待（touch-action:manipulation）
           + 文字不可选（免得误触发长按选词）+ 去掉焦点框。 */
        '-webkit-tap-highlight-color:transparent;touch-action:manipulation;',
        '-webkit-user-select:none;user-select:none;outline:none;-webkit-appearance:none;}',
        /* 26/09/20 第 15 轮：用户要的「质感」= 浅绿底 + 鼠标放上去有阴影（不再做渐变/高光那套） */
        '@media (hover:hover) and (pointer:fine){.rte-bar button:hover{background:#cfead0;',
        'box-shadow:0 5px 13px rgba(40,110,60,.24),0 1px 3px rgba(40,110,60,.12);',
        'transform:translateY(-1px);}',
        /* 第 16 轮：:active 只留给有鼠标的设备。触摸设备上 :active 会在手指离开后赖着不走，
           表现就是「按钮上留着一块按下去的样子」——和上面的点击高亮叠在一起就是那块蓝印子。 */
        '.rte-bar button:active{transform:scale(.97);background:#c2ddc2;}}',
        '.rte-bar button.on{background:#a8c8a8;color:#14361f;font-weight:700;}',
        '.rte-bar .rte-fmt{padding:0 11px;font-size:13.5px;background:#e8e8e8;color:#2f4a2f;}',
        '@media (hover:hover) and (pointer:fine){.rte-bar .rte-fmt:hover{background:#d6d6d6;}}',
        '.rte-bar .rte-img{background:#d4d9c4;color:#2f4a2f;}',
        '@media (hover:hover) and (pointer:fine){.rte-bar .rte-img:hover{background:#c4cdb0;}}',
        '.rte-bar .rte-tbl{background:#cfe0e8;color:#1e4a5a;}',
        '@media (hover:hover) and (pointer:fine){.rte-bar .rte-tbl:hover{background:#b8d4e0;}}',
        '.rte-bar .rte-fml{background:#e2dcef;color:#3d2a6a;}',
        '@media (hover:hover) and (pointer:fine){.rte-bar .rte-fml:hover{background:#d2c9e8;}}',
        /* 26/09/20 第 14 轮：字重与原页面 .note-save 对齐（500）——用户说「保存」被加粗了，不像原来 */
        '.rte-bar .rte-save{background:#a8c8a8;color:#1a3a1a;font-weight:500;}',
        /* 保存成功态：原页面是把按钮文字换成「✅ 已保存」再 1.2 秒后还原。
           26/09/20 第 15 轮：这里**不改配色** —— 原页面只是换字，底色字色都还是
           浅绿底 #a8c8a8 + 深绿字 #1a3a1a。之前改成「白字 + 更深的绿」被用户否了。 */
        '.rte-bar .rte-save.saved{background:#a8c8a8;color:#1a3a1a;}',
        /* 26/09/20 第 15 轮：桌面端和手机端分开给文案 ——
           桌面（宽屏 · 非触摸）用完整写法「插入图片 / 插入表格 / 行内公式 / 块级公式 / 保存笔记」；
           窄屏（≤700px 或触摸设备）用短写法「图片 / 表格 / 行内 / 块级 / 保存」。
           同一颗按钮里放两段文字，靠这两条媒体查询切换显示哪一段。 */
        '.rte-bar .rte-lbl-l{display:inline;}',
        '.rte-bar .rte-lbl-s{display:none;}',
        '@media (hover:hover) and (pointer:fine){.rte-bar .rte-save:hover{background:#94b894;}}',
        '.rte-bar .rte-clear{background:#e6d6d6;color:#6a3a3a;}',
        '@media (hover:hover) and (pointer:fine){.rte-bar .rte-clear:hover{background:#dcc4c4;}}',
        '.rte-bar .rte-sev{width:1px;height:18px;background:#c2ddc2;margin:0 1px;}',
        '.rte-bar .rte-sp{flex:1 1 auto;}',
        /* 窄屏会折成两行，这时那个伸缩占位会把「保存 / 清空」推到右边、和上一行对不齐；
           直接去掉它，按钮紧凑排左，两行看着才是一套。
           第 15 轮：同时切到短文案，并把 gap / 左右内边距收紧 ——
           360/375 实测原来排三行，收紧后稳稳两行（见 _check/probe_v15_shot.log）。 */
        '@media (max-width:700px),(pointer:coarse){',
        '.rte-bar{gap:4px;}',
        '.rte-bar button{padding:0 8px;}',
        '.rte-bar .rte-fmt{padding:0 8px;}',
        '.rte-bar .rte-sev{margin:0;}',
        '.rte-bar .rte-sp{display:none;}',
        '.rte-bar .rte-lbl-l{display:none;}',
        '.rte-bar .rte-lbl-s{display:inline;}}',
        /* 320px 这种小屏再收一档（gap 3 / 内边距 7 / 字号 11.5），保证也是两行 */
        '@media (max-width:340px){.rte-bar{gap:3px;}',
        '.rte-bar button{padding:0 6px;font-size:11.5px;}',
        '.rte-bar .rte-fmt{padding:0 6px;font-size:12.5px;}',
        /* 「清除格式」在超小屏只留「清格式」三个字（emoji 收掉），省下的宽度刚好够排两行 */
        '.rte-bar .rte-cf{font-size:0;}',
        '.rte-bar .rte-cf .rte-lbl-s{font-size:11.5px;}}',

        /* 图片尺寸条（像素版，替换原来的百分比控件） */
        '.rte-imgctl{display:none;align-items:center;gap:9px;margin-top:8px;padding:5px 13px;',
        'background:#edf5ed;border-radius:30px;border:1px solid #c2ddc2;font-size:12.5px;',
        'color:#2a5a2a;flex-wrap:wrap;}',
        /* 26/09/20 第 15 轮：同样改成淡入，不要「啪」一下弹出 */
        '.rte-imgctl.show{display:flex;animation:rteImgCtlIn .18s ease both;}',
        '@keyframes rteImgCtlIn{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);}}',
        '.rte-imgctl input[type=range]{flex:1;min-width:80px;accent-color:#4f8a4f;height:4px;cursor:pointer;}',
        '.rte-imgctl .v{font-weight:600;min-width:52px;text-align:center;}',
        '.rte-imgctl .px{font-size:11.5px;color:#5b7a5b;font-variant-numeric:tabular-nums;white-space:nowrap;}',
        '.rte-imgctl .lock{font-size:11px;color:#4f8a4f;background:#dcecd9;padding:1px 8px;border-radius:30px;white-space:nowrap;}',
        '.rte-imgctl .ok{background:#6fbf8f;border:none;padding:2px 14px;border-radius:30px;font-size:12px;',
        'cursor:pointer;color:#fff;font-weight:600;font-family:inherit;box-shadow:0 1px 5px rgba(80,160,110,.26);}',
        '@media (hover:hover) and (pointer:fine){.rte-imgctl .ok:hover{background:#5bae7d;}}',
        '.rte-imgctl .cancel{background:#dcebd9;border:none;padding:2px 12px;border-radius:30px;font-size:12px;',
        'cursor:pointer;color:#1e4a2a;font-family:inherit;}',
        '@media (hover:hover) and (pointer:fine){.rte-imgctl .cancel:hover{background:#c2ddc2;}}',

        /* 编辑态被选中的图片：用 outline 画圈 —— outline 不占布局空间，
           所以默认状态可以不留那 2px 透明边框，选中时画面也不会跳一下。 */
        '.note-editor img.rte-sel{box-shadow:0 0 0 3px rgba(79,138,79,.28);}',

        /* 富文本里的表格（原页面笔记区没有表格样式，补上，和「我的卡片」一致）
           26/09/21 第 33 轮：与「我的卡片」同步收紧 —— 单元格文字垂直居中，
           padding 6px 10px → 5px 9px，行高 1.55，表格上下留白 8px → 6px。 */
        '.note-editor table{border-collapse:collapse;width:100%;margin:6px 0;font-size:14px;line-height:1.55;}',
        '.note-editor th,.note-editor td{border:1px solid #c2ddc2;padding:5px 9px;min-width:40px;vertical-align:middle;}',
        '.note-editor th{background:#e8f3e8;font-weight:600;text-align:left;}',
        /* 26/09/21：表格后面自动生成的空段落，保证至少有一行高，并且点空白处能把光标放进去 */
        '.note-editor p.rte-after-tbl{min-height:1.6em;}',
        '.note-editor img{border-radius:10px;margin:6px 2px;}',
        /* 26/09/20 第 14 轮：图片不再带浅绿底色 —— 原页面写的是 border:2px solid transparent
           + background:#f0f5f0，透明边框会把底色透出来成一圈浅绿描边（收藏态米色底上最明显）。
           26/09/20 第 15 轮：用户说「无论编辑态还是非编辑态都难受」，那就做得更彻底 ——
           底色、边框、投影全部去掉，图片就是一张干干净净的图；选中态改用 outline 画绿圈。
           这条按子页原有的选择器写，等于给所有套用本脚本的子页统一生效。 */
        '.card-note-area .note-editor img{background:transparent;border:0;',
        '  box-shadow:0 0 0 0 rgba(79,138,79,0);transition:box-shadow .18s ease;}',
        /* 原页面用 .selected 画选中圈（选择器比 .rte-sel 更长），这里同力度覆盖掉 */
        '.card-note-area .note-editor img.selected{background:transparent;border:0;',
        '  box-shadow:0 0 0 3px rgba(79,138,79,.28);}',
        /* 收藏态（米色底）跟着原页面换成金色 */
        '.card-item.favorited .card-note-area .note-editor img.selected{',
        '  box-shadow:0 0 0 3px rgba(212,162,78,.35);}',
        /* 下划线粗细：这是浏览器默认值（偏细），可以用 text-decoration-thickness 调。
           26/09/20 第 18 轮：2px 偏粗，收回 1px；并加 text-decoration-skip-ink:none ——
           浏览器默认会在 g / y / p 这类有下伸笔画的字母处「跳过」一段，中英文混排时
           下划线看着就是断断续续的，关掉跳过即连成一条整线。 */
        '.note-editor u,.note-editor span[style*="underline"]{',
        'text-decoration-thickness:1px;text-underline-offset:2px;',
        'text-decoration-skip-ink:none;-webkit-text-decoration-skip-ink:none;}',
        /* 26/09/20 第 16 轮：笔记正文整段改成纯黑（原来只有加粗是黑的，普通字是墨绿 #1c3322）。
           用户觉得黑字更统一 —— 占位符仍是浅绿斜体（它自己的选择器更长，不会被这里盖掉）。 */
        '.card-note-area .note-editor{color:#000;}',
        '.note-editor b,.note-editor strong{color:#000;}',
        /* 块级公式单独占一行，跟正文分开一点。
           26/09/21 第 33 轮：KaTeX 默认 1.21em 比正文大 21%，在 14px 的笔记里很占地方。
           第 34 轮回调：行内 0.95em 太小、分式看不清 —— 行内 1.05em，独占 1.12em。
           独占块不能再写行高 1：那会把 ∂ / ∫ 这类上下伸展的符号裁掉，行高放到 1.35。
           与「我的卡片」保持同一套参数。 */
        '.note-editor .katex{font-size:1.05em;}',
        '.note-editor .katex-display>.katex{font-size:1.12em;line-height:1;padding:0.25em 0;}',
        '.note-editor .katex-display{margin:1px 0;overflow-x:auto;}',
        /* 粘贴进来的标题：浏览器默认 h1 是 2em（28px），在 14px 的笔记里大得离谱，
           按「我的卡片」同一套值收一档。 */
        '.note-editor h1,.note-editor h2,.note-editor h3,.note-editor h4,.note-editor h5{',
        'color:#1a3322;font-weight:700;line-height:1.45;margin:0.75em 0 0.3em 0;}',
        '.note-editor h1{font-size:15.5px;}',
        '.note-editor h2{font-size:15px;}',
        '.note-editor h3{font-size:14.8px;}',
        '.note-editor h4{font-size:14.6px;}',
        '.note-editor h5{font-size:14.2px;}',

        /* 图片浮层预览 */
        '.rte-viewer{display:none;position:fixed;inset:0;background:rgba(14,32,22,.86);z-index:9999;',
        'align-items:center;justify-content:center;overflow:hidden;}',
        '.rte-viewer.show{display:flex;}',
        '.rte-viewer img{max-width:none;max-height:none;border-radius:8px;cursor:grab;user-select:none;',
        'box-shadow:0 18px 50px rgba(0,0,0,.45);transform-origin:center center;}',
        '.rte-viewer img.dragging{cursor:grabbing;}',
        '.rte-viewer-close{position:absolute;top:14px;right:16px;width:38px;height:38px;border-radius:50%;',
        'border:1px solid rgba(255,255,255,.5);background:rgba(255,255,255,.16);color:#fff;font-size:17px;',
        'cursor:pointer;font-family:inherit;}',
        '@media (hover:hover) and (pointer:fine){.rte-viewer-close:hover{background:rgba(255,255,255,.28);}}',
        '.rte-viewer-bar{position:absolute;left:50%;transform:translateX(-50%);bottom:18px;display:flex;',
        'align-items:center;gap:6px;padding:7px 10px;border-radius:40px;background:rgba(255,255,255,.94);',
        'box-shadow:0 6px 20px rgba(0,0,0,.28);}',
        /* 26/09/20 第 15 轮：按用户要求重做成「浅绿色 + 鼠标放上去有阴影」这套 ——
           不做渐变、不做高光，纯浅绿底 + 深绿字；悬停时底色稍微深一点、浮起 1px 并落下阴影。
           之前那版（渐变 + 白色字 + 绿色主按钮）用户不满意，已换掉。 */
        '.rte-viewer-bar button{width:32px;height:32px;border:none;border-radius:50%;cursor:pointer;',
        'background:#dff0df;color:#1f5a2f;font-size:15px;font-family:inherit;font-weight:700;',
        'line-height:1;display:inline-flex;align-items:center;justify-content:center;',
        'transition:background .18s ease,box-shadow .18s ease,transform .12s ease;}',
        /* 第 16 轮：用户反馈「按下去凹陷太深、悬停跳出来的幅度太大」——
           悬停不再向上跳，只把阴影收小一档；按下只留一层很浅的内阴影（1px）当手感。 */
        '@media (hover:hover) and (pointer:fine){.rte-viewer-bar button:hover{background:#c8e8cb;',
        'box-shadow:0 3px 8px rgba(40,110,60,.22),0 1px 2px rgba(40,110,60,.10);}}',
        '.rte-viewer-bar button:active{background:#bcdfc0;',
        'box-shadow:inset 0 1px 2px rgba(30,80,50,.10);}',
        '.rte-viewer-bar button.txt{width:auto;border-radius:30px;padding:0 14px;font-size:12.5px;',
        'font-weight:600;background:#cfe8d2;}',
        '@media (hover:hover) and (pointer:fine){.rte-viewer-bar button.txt:hover{background:#b7dcbd;}}',
        '.rte-viewer-bar button.txt:active{background:#a8d0af;}',
        '.rte-viewer-bar .val{min-width:46px;text-align:center;font-size:12.5px;font-weight:600;color:#1f5a2f;',
        'font-variant-numeric:tabular-nums;}',
        '.rte-viewer-bar .vsep{width:1px;height:18px;background:#cfe0cf;}',

        /* 表格弹窗 */
        '.rte-modal{display:none;position:fixed;inset:0;background:rgba(14,32,22,.42);z-index:9998;',
        'align-items:center;justify-content:center;}',
        '.rte-modal.show{display:flex;}',
        '.rte-modal .box{background:#fff;border-radius:16px;padding:20px 22px;min-width:270px;',
        'box-shadow:0 16px 44px rgba(0,0,0,.22);font-size:14px;color:#1e3a2a;}',
        '.rte-modal .t{font-weight:700;font-size:15.5px;margin-bottom:14px;}',
        '.rte-modal .row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}',
        '.rte-modal .row label{width:44px;color:#3a5a3a;}',
        '.rte-modal input[type=number]{flex:1;padding:6px 10px;border:1px solid #c2ddc2;border-radius:8px;',
        'font-size:14px;font-family:inherit;outline:none;color:#1e3a2a;}',
        '.rte-modal input[type=number]:focus{border-color:#6a9e6a;box-shadow:0 0 0 3px rgba(80,150,80,.16);}',
        '.rte-modal .hint{font-size:11.5px;color:#7a957a;margin-bottom:14px;}',
        '.rte-modal .acts{display:flex;gap:9px;justify-content:flex-end;}',
        '.rte-modal .acts button{border:none;border-radius:9px;padding:7px 16px;font-size:13px;cursor:pointer;',
        'font-family:inherit;font-weight:600;}',
        '.rte-modal .acts .ok{background:#5ec99a;color:#fff;}',
        '.rte-modal .acts .no{background:#eef4ee;color:#5a7a68;}',
        /* 第 16 轮：尺寸条和弹窗里的按钮同样关掉手机点击高亮（否则也是一块蓝印子） */
        '.rte-imgctl button,.rte-modal button,.rte-viewer-bar button,.rte-viewer-close{',
        '-webkit-tap-highlight-color:transparent;touch-action:manipulation;outline:none;',
        '-webkit-user-select:none;user-select:none;}'
    ].join('');

    function injectStyle() {
        if (document.getElementById('rte-style')) return;
        var s = document.createElement('style');
        s.id = 'rte-style';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    /* ======================= C. 公式渲染 ================================== */
    function renderMathIn(root) {
        if (!root || !window.katex) return;
        /* 26/09/21 第 36 轮：修复「同一行写过一次公式后再写一个就不渲染、时灵时不灵」。
           根因：光标点在已渲染公式后面时，浏览器会把光标放进公式内部（.katex 里最深的
           行内盒），这时新打的 $...$ 文本节点就成了 .katex 的后代，而下方渲染循环会跳过
           .katex 里的所有文本 —— 于是新公式永远不渲染，保不齐还把旧公式结构撑坏。
           治法两步：
           ① 渲染时把 LaTeX 源码记在 data-tex / data-disp 上；光标若溜进公式内部，
              打字前会被 handleFormulaKeys 弹出到公式外，退格/删除则整块删掉——
              全程用 execCommand，所以 Ctrl+Z 仍然有效（第 37 轮：
              上一版把公式设成 contenteditable=false，结果删不掉、撤销也失效，已回退该做法）；
           ② 每次渲染前扫一遍旧公式，发现 .katex 里混入了含 $ 的文本（历史上被打坏的），
              就用 data-tex 还原成源码、连同被打进来的文本一起交还本次循环重新渲染。 */
        root.querySelectorAll('.katex-host').forEach(function (host) {
            var k = host.querySelector('.katex');
            if (!k) return;
            var stray = '';
            var w = document.createTreeWalker(k, NodeFilter.SHOW_TEXT, null);
            var t;
            while ((t = w.nextNode())) {
                if (t.nodeValue.indexOf('$') > -1) stray += t.nodeValue;
            }
            if (!stray) return;
            var tex = host.getAttribute('data-tex') || '';
            var disp = host.getAttribute('data-disp') === '1';
            var src = tex ? (disp ? '$$' + tex + '$$' : '$' + tex + '$') : '';
            host.parentNode.replaceChild(document.createTextNode(src + stray), host);
        });
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var targets = [], n;
        while ((n = walker.nextNode())) {
            var p = n.parentNode;
            if (!p) continue;
            var tag = p.nodeName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'PRE' || tag === 'CODE') continue;
            if (p.closest && p.closest('.katex')) continue;
            if (n.nodeValue.indexOf('$') < 0) continue;
            targets.push(n);
        }
        targets.forEach(function (node) {
            var text = node.nodeValue;
            var re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
            if (!re.test(text)) return;
            re.lastIndex = 0;
            var frag = document.createDocumentFragment();
            var last = 0, m;
            while ((m = re.exec(text))) {
                if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
                var src = (m[1] !== undefined) ? m[1] : m[2];
                var span = document.createElement('span');
                span.className = 'katex-host';
                /* 记下源码，供第 36/37 轮的「打坏了要还原」与公式整体删除使用 */
                span.setAttribute('data-tex', src);
                span.setAttribute('data-disp', (m[1] !== undefined) ? '1' : '0');
                try {
                    span.innerHTML = window.katex.renderToString(src, {
                        displayMode: (m[1] !== undefined),
                        throwOnError: false
                    });
                } catch (e) { span.textContent = m[0]; }
                frag.appendChild(span);
                last = m.index + m[0].length;
            }
            if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
            if (node.parentNode) node.parentNode.replaceChild(frag, node);
        });
    }

    /* ======================= D. 图片：重采样 / 压缩 ======================== */
    function dataUrlHasAlpha(dataUrl) {
        return /^data:image\/png/i.test(dataUrl);
    }

    /* base64 串 → KB（data URL 里 4 个字符编码 3 个字节） */
    function kbOf(dataUrl) { return Math.round((dataUrl ? dataUrl.length : 0) * 0.75 / 1024); }

    /* 第 16 轮：用户看不懂「236 px 原始 206×116 → 目标 236×133 px」这种纯像素串，
       真正关心的是「这图占多大」。这里真去编码一次量出目标体积（比按面积估准），
       拖动时防抖调用，所以不卡手。 */
    function estimateKb(img, targetW, cb) {
        var src = img.__origSrc || img.src;
        var im = new Image();
        im.onload = function () {
            try {
                var w = im.naturalWidth || 1, h = im.naturalHeight || 1;
                var tw = Math.max(1, Math.min(Math.round(targetW), w));
                var th = Math.max(1, Math.round(h * tw / w));
                var c = document.createElement('canvas');
                c.width = tw; c.height = th;
                var ctx = c.getContext('2d');
                ctx.drawImage(im, 0, 0, tw, th);
                if (c.toBlob) c.toBlob(function (b) { cb(b ? Math.round(b.size / 1024) : 0); }, 'image/jpeg', 0.9);
                else cb(kbOf(c.toDataURL('image/jpeg', 0.9)));
            } catch (e) { cb(0); }
        };
        im.onerror = function () { cb(0); };
        im.src = src;
    }

    /* 把 img 真正压缩到 targetW 像素宽（永远从原图 __origSrc 出发，不放大、不一代比一代糊） */
    function resampleToWidth(img, targetW, done) {
        var src = img.__origSrc || img.src;
        var im = new Image();
        im.onload = function () {
            try {
                var w = im.naturalWidth || 1, h = im.naturalHeight || 1;
                var tw = Math.max(1, Math.min(Math.round(targetW), w));   /* 不放大 */
                var th = Math.max(1, Math.round(h * tw / w));
                var c = document.createElement('canvas');
                c.width = tw; c.height = th;
                var ctx = c.getContext('2d');
                var keepAlpha = false;
                try {
                    var probe = document.createElement('canvas');
                    probe.width = Math.min(w, 300); probe.height = Math.min(h, 300);
                    var pctx = probe.getContext('2d');
                    pctx.drawImage(im, 0, 0, probe.width, probe.height);
                    var d = pctx.getImageData(0, 0, probe.width, probe.height).data;
                    for (var i = 3; i < d.length; i += 4) { if (d[i] < 250) { keepAlpha = true; break; } }
                } catch (e) { keepAlpha = false; }
                if (keepAlpha) {
                    ctx.clearRect(0, 0, tw, th);
                    ctx.drawImage(im, 0, 0, tw, th);
                } else {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, tw, th);
                    ctx.drawImage(im, 0, 0, tw, th);
                }
                var out = keepAlpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
                img.src = out;
                img.__curSrc = out;      /* 当前这张；__origSrc 保持不动，反复调也不糊 */
                img.__pxW = tw; img.__pxH = th;
                if (done) done(tw, th, kbOf(src), kbOf(out));
            } catch (e) { if (done) done(0, 0, 0, 0); }
        };
        im.onerror = function () { if (done) done(0, 0, 0, 0); };
        im.src = src;
    }

    /* 插入时的基础瘦身（体积优化，不动尺寸观感） */
    function shrinkImage(img, dataUrl) {
        var MAXW = 1200, QUALITY = 0.72, KEEP_UNDER = 220 * 1024;
        if (!img || !dataUrl || dataUrl.indexOf('data:image/') !== 0) return;
        if (dataUrl.length < KEEP_UNDER) return;
        var im = new Image();
        im.onload = function () {
            try {
                var w = im.naturalWidth || 1, h = im.naturalHeight || 1;
                var scale = Math.min(1, MAXW / w);
                var c = document.createElement('canvas');
                c.width = Math.max(1, Math.round(w * scale));
                c.height = Math.max(1, Math.round(h * scale));
                var ctx = c.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(im, 0, 0, c.width, c.height);
                var out = c.toDataURL('image/jpeg', QUALITY);
                /* 第 16 轮：瘦身后的这张才是真正存下来的「原图」，同步更新基准，
                   否则面板上显示的 KB 会比实际偏大。 */
                if (out && out.length < dataUrl.length) { img.src = out; img.__origSrc = out; }
            } catch (e) {}
        };
        im.src = dataUrl;
    }

    /* ======================= E. 图片浮层预览 ============================== */
    var viewer = null, viewerImg = null, viewerVal = null;
    var vScale = 1, vTx = 0, vTy = 0, vNatW = 1, vNatH = 1, vDragging = false;

    function buildViewer() {
        if (viewer) return;
        viewer = document.createElement('div');
        viewer.className = 'rte-viewer';
        viewer.innerHTML =
            '<img alt="预览">' +
            '<button class="rte-viewer-close" type="button" title="关闭（Esc）">✕</button>' +
            '<div class="rte-viewer-bar">' +
              '<button type="button" data-z="out" title="缩小">−</button>' +
              '<span class="val">100%</span>' +
              '<button type="button" data-z="in" title="放大">＋</button>' +
              '<span class="vsep"></span>' +
              '<button type="button" class="txt" data-z="fit">适应窗口</button>' +
              '<button type="button" class="txt" data-z="one">1:1</button>' +
            '</div>';
        document.body.appendChild(viewer);
        viewerImg = viewer.querySelector('img');
        viewerVal = viewer.querySelector('.val');

        viewer.addEventListener('click', function (e) {
            if (e.target === viewer) closeViewer();
        });
        viewer.querySelector('.rte-viewer-close').addEventListener('click', closeViewer);
        viewer.querySelector('.rte-viewer-bar').addEventListener('click', function (e) {
            var b = e.target.closest('button[data-z]');
            if (!b) return;
            var z = b.getAttribute('data-z');
            if (z === 'in') setScale(vScale * 1.25);
            else if (z === 'out') setScale(vScale / 1.25);
            else if (z === 'fit') fitViewer();
            else if (z === 'one') { setScale(1); vTx = 0; vTy = 0; applyViewer(); }
        });
        viewer.addEventListener('wheel', function (e) {
            e.preventDefault();
            setScale(vScale * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
        }, { passive: false });
        viewerImg.addEventListener('mousedown', function (e) {
            e.preventDefault();
            vDragging = true; viewerImg.classList.add('dragging');
        });
        window.addEventListener('mousemove', function (e) {
            if (!vDragging) return;
            vTx += e.movementX; vTy += e.movementY; applyViewer();
        });
        window.addEventListener('mouseup', function () {
            vDragging = false;
            if (viewerImg) viewerImg.classList.remove('dragging');
        });
        document.addEventListener('keydown', function (e) {
            if (!viewer.classList.contains('show')) return;
            if (e.key === 'Escape') closeViewer();
            else if (e.key === '+' || e.key === '=') setScale(vScale * 1.25);
            else if (e.key === '-') setScale(vScale / 1.25);
        });
    }

    function applyViewer() {
        viewerImg.style.transform = 'translate(' + vTx + 'px,' + vTy + 'px) scale(' + vScale + ')';
        viewerVal.textContent = Math.round(vScale * 100) + '%';
    }
    function setScale(s) {
        vScale = Math.max(0.1, Math.min(8, s));
        applyViewer();
    }
    function fitViewer() {
        var pad = 60;
        var s = Math.min((window.innerWidth - pad * 2) / vNatW, (window.innerHeight - pad * 2 - 50) / vNatH);
        vTx = 0; vTy = 0;
        setScale(Math.max(0.1, Math.min(8, s)));
    }
    function openViewer(src) {
        buildViewer();
        viewerImg.src = src;
        var probe = new Image();
        probe.onload = function () {
            vNatW = probe.naturalWidth || 1;
            vNatH = probe.naturalHeight || 1;
            vTx = 0; vTy = 0;
            fitViewer();
            viewer.classList.add('show');
        };
        probe.onerror = function () {
            vNatW = 1; vNatH = 1; vTx = 0; vTy = 0; setScale(1);
            viewer.classList.add('show');
        };
        probe.src = src;
    }
    function closeViewer() {
        if (viewer) viewer.classList.remove('show');
    }

    /* ======================= F. 表格弹窗 ================================== */
    var tableModal = null;

    function buildTableModal() {
        if (tableModal) return;
        tableModal = document.createElement('div');
        tableModal.className = 'rte-modal';
        tableModal.innerHTML =
            '<div class="box">' +
              '<div class="t">插入表格</div>' +
              '<div class="row"><label>行数</label><input type="number" class="r" value="3" min="1" max="20"></div>' +
              '<div class="row"><label>列数</label><input type="number" class="c" value="3" min="1" max="10"></div>' +
              '<div class="hint">行数含表头行，最多 20 行 / 10 列</div>' +
              '<div class="acts"><button class="no" type="button">取消</button><button class="ok" type="button">插入</button></div>' +
            '</div>';
        document.body.appendChild(tableModal);
        tableModal.addEventListener('click', function (e) {
            if (e.target === tableModal) tableModal.classList.remove('show');
        });
        tableModal.querySelector('.no').addEventListener('click', function () {
            tableModal.classList.remove('show');
        });
        tableModal.querySelector('.ok').addEventListener('click', function () {
            var r = parseInt(tableModal.querySelector('.r').value, 10);
            var c = parseInt(tableModal.querySelector('.c').value, 10);
            if (isNaN(r)) r = 3;
            if (isNaN(c)) c = 3;
            r = Math.max(1, Math.min(20, r));
            c = Math.max(1, Math.min(10, c));
            var html = '<table><thead><tr>';
            for (var i = 0; i < c; i++) html += '<th>表头' + (i + 1) + '</th>';
            html += '</tr></thead><tbody>';
            for (var k = 1; k < r; k++) {
                html += '<tr>';
                for (var j = 0; j < c; j++) html += '<td>&nbsp;</td>';
                html += '</tr>';
            }
            html += '</tbody></table><p class="rte-after-tbl"><br></p>';
            var editor = tableModal.__editor;
            var rec = tableModal.__range;
            tableModal.classList.remove('show');
            if (editor) {
                /* 26/09/21：弹窗打开前记录的真实选区最可靠；用 forceRange 直接传进去，
               绕过 savedRange/pressUntil 那套保护逻辑，避免被重置到开头。 */
                insertHtmlAtCursor(editor, html, (rec && editor.contains(rec.startContainer)) ? rec : null);
            }
        });
    }
    function openTableModal(editor) {
        buildTableModal();
        tableModal.__editor = editor;
        /* 26/09/21：blur 前先把当前真实选区记下来，避免弹窗期间浏览器把选区抖掉，
           导致表格被插到笔记开头或最后而不是光标位置。 */
        var sel = window.getSelection();
        var r = (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode))
            ? sel.getRangeAt(0).cloneRange()
            : (savedRange && editor.contains(savedRange.startContainer) ? savedRange.cloneRange() : null);
        tableModal.__range = r;
        tableModal.querySelector('.r').value = 3;
        tableModal.querySelector('.c').value = 3;
        tableModal.classList.add('show');
        /* 26/09/20 第 17 轮：手机上点「表格」时会弹出软键盘，可光标还留在笔记的文字里，
           没法直接改行列数 —— 得先把焦点从笔记框挪走（键盘才会对准输入框），
           再把光标放进「行数」并全选，手指一敲就替换默认值。
           blur 之后留 80ms 给键盘换目标，不然有些手机 focus 会被键盘动画吃掉。 */
        try { editor.blur(); } catch (e) {}
        setTimeout(function () {
            var r = tableModal.querySelector('.r');
            if (!r) return;
            try { r.focus({ preventScroll: true }); } catch (e) { try { r.focus(); } catch (e2) {} }
            try { if (r.select) r.select(); } catch (e) {}
        }, 80);
    }

    /* ======================= G. 光标处插入 ================================ */
    var savedRange = null;
    var pressUntil = 0;     /* 26/09/20 第 13 轮：按工具栏按钮的选区抖动窗口 */
    var lastEdAct = 0;      /* 最近一次真的在笔记框里动过（点/敲/摸/粘贴） */

    /* 记下的位置如果已经不在文档里（内容被整体换过），就别再用它 */
    function pruneSaved() {
        if (!savedRange) return;
        try {
            if (document.body.contains(savedRange.startContainer) && document.body.contains(savedRange.endContainer)) return;
        } catch (e) {}
        savedRange = null;
    }

    /* 第 16 轮：在 document 的**捕获阶段**就把「按下了工具栏按钮」这件事记下来。
       捕获阶段跑在浏览器默认动作之前，而手机上「清掉选区 + 塞回一个空光标」恰恰是
       touchstart 的默认动作。等事件冒泡到工具栏上时选区早被清掉了，怎么补都晚一步 ——
       这就是 BIU「时灵时不灵」的根子。这里先拍快照，后面 click 时再从快照恢复。 */
    function editorOf(node) {
        var a = node && node.closest ? node.closest('.card-note-area') : null;
        return a ? a.querySelector('.note-editor') : null;
    }
    ['touchstart', 'mousedown'].forEach(function (ev) {
        document.addEventListener(ev, function (e) {
            if (!e.target || !e.target.closest) return;
            if (!e.target.closest('.rte-bar')) return;
            var ed = editorOf(e.target);
            if (!ed) return;
            pressUntil = Date.now() + 900;
            rememberRange(ed);
        }, true);
    });

    function rememberRange(editor) {
        pruneSaved();
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        if (!sel.anchorNode || !editor.contains(sel.anchorNode)) return;
        var r;
        try { r = sel.getRangeAt(0).cloneRange(); } catch (e) { return; }
        /* 第 16 轮：判断「要不要记」只看一件事 —— 是不是正按着工具栏按钮。
           旧写法还额外看「最近 900ms 有没有在笔记框里动过」，可手指拖选文字
           不触发 click / keyup，这个时间窗就经常判错，于是 BIU 才时灵时不灵。 */
        if (r.collapsed && savedRange && Date.now() < pressUntil) return;
        savedRange = r;
    }
    /* 命令执行完再记一次：这时 pressUntil 已清掉，记的是命令后的真实光标 */
    function commitRange(editor) { pressUntil = 0; rememberRange(editor); }

    /* 手里这个「空光标」是不是别人塞进来的（点工具栏 / 触摸时选区被抖掉） */
    function liveCaretIsBogus(editor) {
        pruneSaved();
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return false;
        var r;
        try { r = sel.getRangeAt(0); } catch (e) { return false; }
        if (!r.collapsed) return false;            /* 手里是真选区 → 当然可信 */
        if (!savedRange) return false;
        if (!savedRange.collapsed) return true;    /* 刚才明明有选区，现在却只剩空光标 → 是被清掉的 */
        return Date.now() < pressUntil;            /* 两个都是空光标：只在按按钮那一下怀疑当前的 */
    }
    function insertNodeAtCursor(editor, node, forceRange) {
        ensureEditable(editor);
        var sel = window.getSelection();
        var range = forceRange || ((sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode) && !liveCaretIsBogus(editor))
            ? sel.getRangeAt(0)
            : savedRange);
        if (!range || !editor.contains(range.startContainer)) {
            range = document.createRange();
            var last = editor.lastChild;
            if (last) range.setStartAfter(last);
            else range.selectNodeContents(editor);
            range.collapse(false);
        }
        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        savedRange = range.cloneRange();
        commitRange(editor);
    }
    function insertHtmlAtCursor(editor, html, forceRange) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var frag = document.createDocumentFragment(), n;
        while ((n = tmp.firstChild)) frag.appendChild(n);
        var lastNode = frag.lastChild;
        ensureEditable(editor);
        var sel = window.getSelection();
        var range = forceRange || ((sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode) && !liveCaretIsBogus(editor))
            ? sel.getRangeAt(0)
            : savedRange);
        /* 26/09/21：如果既没有真实选区也没有 savedRange，就在编辑器末尾创建一个 range，
           绝不让内容跑到最前面。 */
        if (!range || !editor.contains(range.startContainer)) {
            range = document.createRange();
            var last = editor.lastChild;
            if (last) range.setStartAfter(last);
            else range.selectNodeContents(editor);
            range.collapse(false);
        }
        if (range && editor.contains(range.startContainer)) {
            range.deleteContents();
            range.insertNode(frag);
            var rr = document.createRange();
            /* 26/09/21：表格后面自动加了一个 <p class="rte-after-tbl"><br></p>，
               插入后要把光标放到这个 p 里面（br 之前），用户才能直接在表格后打字换行。 */
            if (lastNode && lastNode.classList && lastNode.classList.contains('rte-after-tbl') && lastNode.firstChild) {
                rr.setStartBefore(lastNode.firstChild);
                rr.collapse(true);
            } else if (lastNode && lastNode.parentNode) {
                rr.setStartAfter(lastNode);
                rr.collapse(true);
            } else {
                rr.selectNodeContents(editor);
                rr.collapse(false);
            }
            sel.removeAllRanges();
            sel.addRange(rr);
            savedRange = rr.cloneRange();
        } else {
            editor.appendChild(frag);
        }
        commitRange(editor);
    }
    function insertTextAtCursor(editor, text, forceRange) {
        ensureEditable(editor);
        var sel = window.getSelection();
        var range = forceRange || ((sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode) && !liveCaretIsBogus(editor))
            ? sel.getRangeAt(0)
            : savedRange);
        if (!range || !editor.contains(range.startContainer)) {
            range = document.createRange();
            var last = editor.lastChild;
            if (last) range.setStartAfter(last);
            else range.selectNodeContents(editor);
            range.collapse(false);
        }
        range.deleteContents();
        var tn = document.createTextNode(text);
        range.insertNode(tn);
        range.setStartAfter(tn);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        savedRange = range.cloneRange();
        commitRange(editor);
    }
    /* 让笔记框进入可编辑态（原页面默认 false，点击才 true） */
    function ensureEditable(editor) {
        pruneSaved();
        editor.setAttribute('contenteditable', 'true');
        /* 已经聚焦就别再 focus —— 多余的 focus 会把刚选中的文本弄丢。
           第 16 轮：真要 focus 时带 preventScroll —— 手机上 focus 会顶起键盘并滚动页面，
           滚一下就可能把手指底下的按钮挪走，表现就是「点了没反应 / 点不动」。 */
        if (document.activeElement !== editor) {
            try { editor.focus({ preventScroll: true }); }
            catch (e) { try { editor.focus(); } catch (e2) {} }
            /* 26/09/21：没有保存过选区时，浏览器 focus 后常把光标放到编辑器开头，
               导致表格 / 图片 / 公式等「在光标处插入」的内容跑到最前面。
               这里把光标默认放到末尾，并记下来，后续插入就落在合理位置。 */
            if (!savedRange) {
                try {
                    var sel = window.getSelection();
                    var r = document.createRange();
                    var last = editor.lastChild;
                    if (last) r.setStartAfter(last);
                    else r.selectNodeContents(editor);
                    r.collapse(false);
                    if (sel) { sel.removeAllRanges(); sel.addRange(r); }
                    savedRange = r.cloneRange();
                } catch (e) {}
            }
        }
    }

    /* 把记住的光标/选区重新放回笔记框（手机上点按钮时，系统常把选区清掉）。
       手里本来就有一个可信的选区时，什么都不用做。 */
    function restoreRange(editor) {
        var sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && sel.anchorNode && editor.contains(sel.anchorNode)
            && !liveCaretIsBogus(editor)) return;
        if (!savedRange) return;
        try {
            if (!sel) return;
            sel.removeAllRanges();
            sel.addRange(savedRange);
        } catch (e) {}
    }

    /* 插入文本后选中其中一段（公式按钮用：插「公式」两字并选中，直接打字替换） */
    function selectInsertedText(editor, text, pad) {
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        var r = sel.getRangeAt(0);
        var n = r.startContainer, at = r.startOffset;
        /* 光标常常停在“元素边界”而不是文本节点里（insertNode 之后就是这样），
           这时往回退一格找刚插进去的那个文本节点 */
        if (!n || n.nodeType !== 3) {
            var cand = n ? n.childNodes[at - 1] : null;
            if (cand && cand.nodeType === 3) { n = cand; at = cand.textContent.length; }
            else if (cand && cand.nodeType === 1 && cand.lastChild && cand.lastChild.nodeType === 3) {
                n = cand.lastChild; at = n.textContent.length;
            }
        }
        if (!n || n.nodeType !== 3) return;
        var s = n.textContent, base = at - text.length;
        if (base < 0 || s.slice(base, at) !== text) return;
        var rr = document.createRange();
        rr.setStart(n, base + pad);
        rr.setEnd(n, at - pad);
        sel.removeAllRanges(); sel.addRange(rr);
        commitRange(editor);
    }

    /* ======================= H. 图片尺寸条（像素） ========================= */
    /* 26/09/20 第 18 轮：笔记框整行的可用宽度 —— 图片尺寸条的上限就按它来。
       原来滑块写死 60~620px，拖到后面图片会比笔记框还宽：框里只能横向撑出去，
       高度却被顶住，看着就是「只往横里长、比例变形」。
       现在上限 = 笔记框整行宽（和「我的卡片」同一套算法），拖到底也不会超出窗口。 */
    function editorRowWidth(editor) {
        var cs = window.getComputedStyle(editor);
        var w = editor.clientWidth
              - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0) - 6;
        return Math.max(160, Math.round(w));
    }
    var IMG_MIN_PX = 60;

    function buildImgCtl(area, editor) {
        var ctl = document.createElement('div');
        ctl.className = 'rte-imgctl';
        ctl.innerHTML =
            '<span>📐 尺寸</span>' +
            '<input type="range" min="60" max="620" step="2" value="360">' +
            '<span class="v">360 px</span>' +
            '<span class="px"></span>' +
            '<span class="lock" title="宽高比锁定；点「确认压缩」会按目标尺寸真的把图片本身压小">🔗 锁定比例</span>' +
            '<button class="ok" type="button">确认压缩</button>' +
            '<button class="cancel" type="button">取消</button>';
        return ctl;
    }

    function openImgCtl(area, editor, img) {
        var ctl = area.querySelector('.rte-imgctl');
        if (!ctl) return;
        ctl.classList.add('show');
        ctl.__img = img;

        var range = ctl.querySelector('input[type=range]');
        var val = ctl.querySelector('.v');
        var px = ctl.querySelector('.px');

        if (!img.__origSrc) img.__origSrc = img.src;
        var natW = img.__origW || img.__pxW || img.naturalWidth || 0;
        var natH = img.__origH || img.__pxH || img.naturalHeight || 0;
        if (!natW) natW = img.naturalWidth || 0;
        if (!natH) natH = img.naturalHeight || 0;
        img.__origW = natW; img.__origH = natH;
        var origKb = kbOf(img.__origSrc);
        var curW = Math.round(img.getBoundingClientRect().width) || natW || 360;
        ctl.__before = img.style.cssText;

        /* 子页 CSS 给笔记图片写了 max-height:300px。不顶掉的话，把宽度调大时
           高度会卡在 300px 不再跟着长 —— 宽高比就这么被压坏了（用户报的「不再锁定比例」）。 */
        img.style.maxHeight = 'none';

        /* 第 18 轮：上限改成笔记框整行宽（不再写死 620），拖到底也压在窗口里 */
        var maxW = editorRowWidth(editor);
        range.min = String(IMG_MIN_PX);
        range.max = String(Math.max(IMG_MIN_PX + 20, maxW));
        range.value = Math.max(IMG_MIN_PX, Math.min(parseInt(range.max, 10), curW));
        val.textContent = range.value + ' px';

        var estT = null;
        function refreshPx() {
            var tw = parseInt(range.value, 10);
            var th = natW ? Math.round(natH * tw / natW) : 0;
            px.textContent = natW
                ? ('原图 ' + natW + '×' + natH + '（' + origKb + ' KB） → 目标 ' + tw + '×' + th)
                : '';
            /* 目标体积要真编码一次才准；拖动时防抖 200ms，不卡手 */
            clearTimeout(estT);
            estT = setTimeout(function () {
                estimateKb(img, tw, function (kb) {
                    if (parseInt(range.value, 10) !== tw) return;   /* 手已经拖走了，这次结果作废 */
                    px.textContent = natW
                        ? ('原图 ' + natW + '×' + natH + '（' + origKb + ' KB） → 目标 ' + tw + '×' + th + '（' + kb + ' KB）')
                        : '';
                });
            }, 200);
        }
        refreshPx();

        range.oninput = function () {
            val.textContent = range.value + ' px';
            img.style.width = range.value + 'px';
            /* 第 18 轮：maxWidth 用 100% 而不是 none —— 万一窗口比上限还窄，
               图片也只是跟着缩到框内（比例不变），不会再横向撑出窗口。 */
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.maxHeight = 'none';
            img.removeAttribute('height');
            refreshPx();
        };

        ctl.querySelector('.ok').onclick = function () {
            var tw = parseInt(range.value, 10);
            resampleToWidth(img, tw, function (w, h, kbBefore, kbAfter) {
                img.style.width = w + 'px';
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.maxHeight = 'none';
                ctl.classList.remove('show');
                showTip('已压缩成 ' + w + '×' + h + ' · 体积 ' + kbBefore + ' KB → ' + kbAfter + ' KB');
            });
        };
        ctl.querySelector('.cancel').onclick = function () {
            img.style.cssText = ctl.__before || '';
            ctl.classList.remove('show');
        };
    }

    /* ======================= I. 轻提示 ==================================== */
    var tipEl = null, tipTimer = null;
    function showTip(msg) {
        if (!tipEl) {
            tipEl = document.createElement('div');
            tipEl.style.cssText =
                'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:10000;' +
                'background:rgba(30,58,42,.92);color:#fff;font-size:13px;padding:9px 18px;border-radius:30px;' +
                'box-shadow:0 8px 24px rgba(0,0,0,.24);transition:opacity .25s;pointer-events:none;' +
                'font-family:inherit;max-width:88vw;text-align:center;';
            document.body.appendChild(tipEl);
        }
        tipEl.textContent = msg;
        tipEl.style.opacity = '1';
        clearTimeout(tipTimer);
        tipTimer = setTimeout(function () { tipEl.style.opacity = '0'; }, 2000);
    }

    /* 26/09/20 第 14 轮：保存成功的按钮反馈（原页面 .note-save 上的「✅ 已保存」，
       我们那条按钮被藏了，所以在自己的按钮上重放一遍），过一会儿还原原文字。
       第 17 轮：1.2 秒太短 —— 用户还想在笔记里接着写，按钮却已经变回「保存」了，
       看着像没保存成功。放宽到 3 秒（离开页面本来就有提醒，不怕漏存）。 */
    var SAVED_TIP_MS = 3000;
    function showSaved(btn) {
        if (!btn) return;
        if (!btn.__savedHtml) btn.__savedHtml = btn.innerHTML;   /* 记住「💾 保存笔记/保存」的原始结构 */
        btn.innerHTML = '✅ 已保存';
        btn.classList.add('saved');
        clearTimeout(btn.__savedT);
        btn.__savedT = setTimeout(function () {
            btn.innerHTML = btn.__savedHtml;
            btn.classList.remove('saved');
        }, SAVED_TIP_MS);
    }

    /* ======================= J. 工具栏挂载 ================================ */
    function attach(area) {
        if (area.dataset.rteReady === '1') return;
        var editor = area.querySelector('.note-editor');
        if (!editor) return;
        area.dataset.rteReady = '1';

        /* 原按钮条和新工具栏重复，藏起来（保留 DOM，保存/清空仍复用它的逻辑） */
        var oldActions = area.querySelector('.note-actions');
        if (oldActions) oldActions.style.display = 'none';
        var oldCtl = area.querySelector('.img-resize-control');
        if (oldCtl) oldCtl.style.display = 'none';

        /* 图片尺寸条 + 工具栏 */
        var ctl = buildImgCtl(area, editor);
        var bar = document.createElement('div');
        bar.className = 'rte-bar';
        bar.innerHTML =
            '<button type="button" class="rte-fmt" data-cmd="bold" title="加粗（Ctrl+B）"><b>B</b></button>' +
            '<button type="button" class="rte-fmt" data-cmd="italic" title="斜体（Ctrl+I）"><i>I</i></button>' +
            '<button type="button" class="rte-fmt" data-cmd="underline" title="下划线（Ctrl+U）"><u>U</u></button>' +
            /* 26/09/20 第 18 轮：清除格式 —— 选了字就去掉加粗/斜体/下划线；
               只是光标停着，就把「接下来打字会带上的样式」关掉（在粗体后面接着写也不再是粗的）。 */
            '<button type="button" class="rte-fmt rte-cf" data-act="clearfmt" ' +
            'title="清除格式：选中文字 → 去掉加粗/斜体/下划线；只是光标停着 → 后面打的字不再跟着前面的样式">' +
            '<span class="rte-lbl-l">清格式</span><span class="rte-lbl-s">清格式</span></button>' +
            '<span class="rte-sev"></span>' +
            '<button type="button" class="rte-img" data-act="img" title="插入图片（也可直接粘贴截图）">🖼️ ' +
            '<span class="rte-lbl-l">插入图片</span><span class="rte-lbl-s">图片</span></button>' +
            '<button type="button" class="rte-tbl" data-act="table" title="插入表格">▦ ' +
            '<span class="rte-lbl-l">插入表格</span><span class="rte-lbl-s">表格</span></button>' +
            '<button type="button" class="rte-fml" data-act="inline" title="插入行内公式（$…$），直接打 LaTeX 即可">∑ ' +
            '<span class="rte-lbl-l">行内公式</span><span class="rte-lbl-s">行内</span></button>' +
            '<button type="button" class="rte-fml" data-act="block" title="插入块级公式（$$…$$，独占一行）">∑ ' +
            '<span class="rte-lbl-l">块级公式</span><span class="rte-lbl-s">块级</span></button>' +
            '<span class="rte-sp"></span>' +
            '<button type="button" class="rte-save" data-act="save" title="保存笔记">💾 ' +
            '<span class="rte-lbl-l">保存笔记</span><span class="rte-lbl-s">保存</span></button>' +
            '<button type="button" class="rte-clear" data-act="clear" title="清空笔记">🗑️ 清空</button>';
        area.appendChild(ctl);
        area.appendChild(bar);

        /* 按钮按下时别让编辑框失焦（否则原页面会把 contenteditable 关掉） */
        bar.addEventListener('mousedown', function (e) {
            if (!e.target.closest || !e.target.closest('button')) return;
            e.preventDefault();
            pressUntil = Date.now() + 800;   /* 这段窗口里的选区抖动一律不算 */
            rememberRange(editor);
        });
        /* 手机上没有 mousedown 这一下：在 touchstart 阶段就先把选区存好 */
        bar.addEventListener('touchstart', function (e) {
            if (e.target.closest && !e.target.closest('button')) return;
            pressUntil = Date.now() + 800;
            rememberRange(editor);
        }, { passive: true });

        /* BIU + 工具按钮。第 16 轮：抽成函数，因为点击有可能被手机浏览器吞掉（见下面兜底） */
        function runBtn(b) {
            if (Date.now() < (b.__runAt || 0) + 300) return;   /* 防重复执行 */
            b.__runAt = Date.now();
            var cmd = b.getAttribute('data-cmd');
            if (cmd) {
                ensureEditable(editor);
                restoreRange(editor);   /* 13 轮：先恢复选区再执行，手机上点 B 才真的加粗 */
                try { document.execCommand(cmd, false, null); } catch (x) {}
                commitRange(editor);
                syncFmt(bar);
                return;
            }
            var act = b.getAttribute('data-act');
            if (act === 'img') {
                /* 第 17 轮：编辑态（光标在闪、键盘弹着）直接弹文件选择器时，
                   键盘收起和选择器弹出撞在一起，页面会「闪一下」。
                   这里先主动收键盘、隔 160ms 再弹选择器 —— 两件事排队做，观感就顺了。
                   光标位置前面已经记下（rememberRange），收键盘不会丢。 */
                try { editor.blur(); } catch (e) {}
                var ed2 = editor, ar2 = area;
                setTimeout(function () {
                    pickImage(function (file) { readAndInsertImage(ar2, ed2, file); });
                }, 160);
            } else if (act === 'clearfmt') {
                /* 26/09/20 第 18 轮：清除格式
                   ① 选了字 → removeFormat 去掉加粗/斜体/下划线；
                   ② 只是光标停着 → 把几项「待生效」的打字样式逐个关掉，
                      这样在粗体后面接着打的字就是正常字，不再被前面的样式带着走。 */
                ensureEditable(editor);
                restoreRange(editor);
                editor.focus();
                try { document.execCommand('styleWithCSS', false, false); } catch (x) {}
                var sel = window.getSelection();
                var collapsed = !sel || !sel.rangeCount || sel.isCollapsed;
                if (!collapsed) {
                    try { document.execCommand('removeFormat'); } catch (x) {}
                    try { document.execCommand('unlink'); } catch (x) {}
                    try {
                        editor.querySelectorAll('b,i,u,strong,em').forEach(function (el) {
                            if (!el.textContent && !el.querySelector('img,br')) el.remove();
                        });
                    } catch (x) {}
                } else {
                    ['bold', 'italic', 'underline', 'strikeThrough'].forEach(function (c) {
                        try { if (document.queryCommandState(c)) document.execCommand(c, false, null); } catch (x) {}
                    });
                }
                commitRange(editor);
                syncFmt(bar);
                showTip('已清除格式');
            } else if (act === 'table') {
                openTableModal(editor);
            } else if (act === 'inline') {
                var t1 = '$公式$';
                insertTextAtCursor(editor, t1);
                selectInsertedText(editor, t1, 1);
                /* 第 17 轮：用户嫌弹提示烦 —— 插完已经自动选中「公式」二字，不用再教一遍 */
            } else if (act === 'block') {
                var t2 = '$$公式$$';
                insertTextAtCursor(editor, t2);
                selectInsertedText(editor, t2, 2);
            } else if (act === 'save') {
                var sv = area.querySelector('.note-save');
                if (sv) sv.click();
                /* 26/09/20 第 14 轮：原页面的「✅ 已保存」是写在它自己的 .note-save 上，
                   而那条按钮排被本脚本藏起来了（display:none），所以用户点了看不到任何反馈。
                   这里在我们自己的按钮上重放一遍原效果：换字 + 变绿，1.2 秒后还原。 */
                showSaved(b);
                setTimeout(function () { renderMathIn(editor); }, 60);
            } else if (act === 'clear') {
                var cv = area.querySelector('.note-clear');
                if (cv) cv.click();
            }
        }

        bar.addEventListener('click', function (e) {
            var b = e.target.closest('button');
            if (!b) return;
            b.__clickAt = Date.now();
            runBtn(b);
        });
        /* 第 16 轮兜底：手机上 click 偶尔会被浏览器吞掉（手指微动、键盘顶起页面、
           选区小手柄正好盖住按钮都会），表现就是「按钮点不动」。
           touchend 之后 320ms 还没等到 click 就自己跑一遍；click 真来了就不跑。 */
        bar.addEventListener('touchend', function (e) {
            var b = e.target.closest && e.target.closest('button');
            if (!b) return;
            var t = Date.now();
            setTimeout(function () {
                if ((b.__clickAt || 0) >= t) return;   /* click 正常到了 */
                runBtn(b);
            }, 320);
        }, { passive: true });

        /* 选区变化时：记下来 + 同步 B/I/U 的按下状态。
           13 轮起这里也负责记选区 —— 手机上用手指拖动选择文字时，
           只有 selectionchange 最靠得住（touchend 不一定落在笔记框上）。 */
        document.addEventListener('selectionchange', function () {
            var sel = window.getSelection();
            if (!sel || !sel.anchorNode || !editor.contains(sel.anchorNode)) return;
            rememberRange(editor);
            syncFmt(bar);
        });

        /* 表格删除：contenteditable 默认不会删表格，光标在表后按 Backspace 或
           选中整个表格按 Backspace/Delete 都删不掉，这里手动处理。 */
        function rangeContainsNode(range, node) {
            try {
                var sel = window.getSelection();
                if (sel && sel.containsNode) return sel.containsNode(node, false);
            } catch (x) {}
            var nr = document.createRange();
            nr.selectNode(node);
            return range.compareBoundaryPoints(Range.START_TO_START, nr) <= 0 &&
                   range.compareBoundaryPoints(Range.END_TO_END, nr) >= 0;
        }
        function isEmptyBlock(block) {
            if (!block) return false;
            var html = block.innerHTML.trim();
            return html === '' || html === '<br>' || html === '<br/>' || html === '<br />';
        }
        function removeTableAndPlaceCaret(editor, table) {
            var sel = window.getSelection();
            /* 26/09/21：优先用 execCommand('delete')，这样浏览器会把删表动作写进 undo 栈，
               用户按 Ctrl+Z 能撤销。选区直接覆盖整张表再删；如果浏览器没删干净再手动兜底。 */
            var r = document.createRange();
            r.selectNode(table);
            sel.removeAllRanges();
            sel.addRange(r);
            var ok = false;
            try { ok = document.execCommand('delete', false, null); } catch (x) {}
            if (ok && !editor.contains(table)) {
                /* 浏览器删完后光标位置不可控，确保后面有个空段落给用户继续打字 */
                var p = editor.querySelector('p');
                if (!p) {
                    p = document.createElement('p');
                    p.innerHTML = '<br>';
                    editor.appendChild(p);
                }
                var rr = document.createRange();
                rr.setStart(p, 0);
                rr.collapse(true);
                sel.removeAllRanges();
                sel.addRange(rr);
                rememberRange(editor);
                return;
            }
            /* 兜底：浏览器没删或没写进 undo，走手动移除 */
            var p2 = table.nextElementSibling;
            if (!p2 || p2.tagName !== 'P' || p2.textContent.trim() !== '') {
                p2 = document.createElement('p');
                p2.innerHTML = '<br>';
                table.parentNode.insertBefore(p2, table);
            }
            table.remove();
            var rr2 = document.createRange();
            rr2.setStart(p2, 0);
            rr2.collapse(true);
            sel.removeAllRanges();
            sel.addRange(rr2);
            rememberRange(editor);
        }
        function handleTableDelete(editor, e) {
            if (e.key !== 'Backspace' && e.key !== 'Delete') return false;
            var sel = window.getSelection();
            if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return false;
            var range = sel.getRangeAt(0);
            var table = null;

            if (!range.collapsed) {
                /* 选中范围包含整个表格，或跨越多个单元格，删表 */
                var ca = range.commonAncestorContainer;
                if (ca.nodeType === 3) ca = ca.parentNode;
                while (ca && ca !== editor) {
                    if (/^TABLE|TBODY|THEAD|TFOOT|TR$/i.test(ca.tagName)) {
                        table = ca.tagName === 'TABLE' ? ca : (ca.closest && ca.closest('table'));
                        break;
                    }
                    ca = ca.parentNode;
                }
                if (!table) {
                    editor.querySelectorAll('table').forEach(function (t) {
                        if (!table && rangeContainsNode(range, t)) table = t;
                    });
                }
                if (table) {
                    e.preventDefault();
                    removeTableAndPlaceCaret(editor, table);
                    return true;
                }
            } else {
                /* 折叠光标在表格边界 */
                var sc = range.startContainer, so = range.startOffset;
                var block = sc.nodeType === 3 ? sc.parentNode : sc;
                while (block && block !== editor && !/^P|DIV|H[1-6]|LI$/i.test(block.tagName)) {
                    block = block.parentNode;
                }

                if (e.key === 'Backspace') {
                    var prev = null;
                    if (sc === editor && so > 0) prev = sc.childNodes[so - 1];
                    else if (block && block !== editor && isEmptyBlock(block)) prev = block.previousSibling;
                    if (prev && prev.tagName === 'TABLE') table = prev;
                } else {
                    var next = null;
                    if (sc === editor) next = sc.childNodes[so];
                    else if (block && block !== editor) next = block.nextSibling;
                    if (next && next.tagName === 'TABLE') table = next;
                }
                if (table) {
                    e.preventDefault();
                    removeTableAndPlaceCaret(editor, table);
                    return true;
                }
            }
            return false;
        }

        /* 26/09/21 第 37 轮：公式（.katex-host）的键盘处理。
           上一版把公式设成 contenteditable=false 防光标钻进去，结果删不掉、Ctrl+Z 失效。
           现在公式保持可编辑（原生删除/撤销照常），只在两个时机接管：
           ① 退格/删除键落在公式上或紧贴公式 → 整块删掉，用 execCommand 所以能撤销；
           ② 光标溜进公式内部时打字 → 先把光标弹到公式外面，再让字符正常输入。 */
        function caretHost() {
            var sel = window.getSelection();
            if (!sel || !sel.rangeCount) return null;
            var r = sel.getRangeAt(0);
            var n = r.startContainer;
            var el = n.nodeType === 1 ? n : n.parentNode;
            return (el && el.closest) ? el.closest('.katex-host') : null;
        }
        function placeCaretAfter(host) {
            var sel = window.getSelection();
            if (!sel) return;
            var rr = document.createRange();
            rr.setStartAfter(host);
            rr.collapse(true);
            sel.removeAllRanges();
            sel.addRange(rr);
        }
        /* 光标紧贴的前/后一个公式块（Backspace 看前面，Delete 看后面） */
        function adjacentHost(back) {
            var sel = window.getSelection();
            if (!sel || !sel.rangeCount) return null;
            var r = sel.getRangeAt(0);
            if (!r.collapsed) return null;
            var c = r.startContainer;
            if (c.nodeType === 3) {
                var atEdge = back ? (r.startOffset === 0) : (r.startOffset === c.nodeValue.length);
                if (!atEdge) return null;
                var sib = back ? c.previousSibling : c.nextSibling;
                while (sib && sib.nodeType === 3 && !sib.nodeValue.length) sib = back ? sib.previousSibling : sib.nextSibling;
                if (!sib || sib.nodeType !== 1) return null;
                if (sib.classList.contains('katex-host')) return sib;
                var d = back ? sib.lastElementChild : sib.firstElementChild;
                if (d && d.classList.contains('katex-host')) return d;
                return null;
            }
            var kids = c.childNodes;
            var node = kids[back ? r.startOffset - 1 : r.startOffset];
            if (!node || node.nodeType !== 1) return null;
            if (node.classList.contains('katex-host')) return node;
            var dd = back ? node.lastElementChild : node.firstElementChild;
            return (dd && dd.classList.contains('katex-host')) ? dd : null;
        }
        function deleteHost(host) {
            var sel = window.getSelection();
            var r = document.createRange();
            r.selectNode(host);
            sel.removeAllRanges();
            sel.addRange(r);
            var ok = false;
            try { ok = document.execCommand('delete', false, null); } catch (x) {}
            if (!ok || document.contains(host)) { try { host.parentNode.removeChild(host); } catch (x) {} }
        }
        function handleFormulaKeys(editor, e) {
            if (editor.getAttribute('contenteditable') !== 'true') return false;
            if (e.ctrlKey || e.metaKey || e.altKey) return false;
            var sel = window.getSelection();
            if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return false;
            if (e.key === 'Backspace' || e.key === 'Delete') {
                var h = caretHost() || adjacentHost(e.key === 'Backspace');
                if (!h || !editor.contains(h)) return false;
                e.preventDefault();
                deleteHost(h);
                rememberRange(editor);
                return true;
            }
            /* 普通字符：光标在公式里就把光标弹到公式后面，避免打进公式内部 */
            if (e.key && e.key.length === 1) {
                var inside = caretHost();
                if (!inside) return false;
                placeCaretAfter(inside);
            }
            return false;
        }

        /* 兜底：上面只在 keydown 时弹光标，但输入法、execCommand('insertText')、
           粘贴等路径不经过 keydown。这里在真正写入前再拦一次（输入法交给
           compositionstart，避免打断正在拼字的 composition）。 */
        editor.addEventListener('beforeinput', function (e) {
            if (!e || e.inputType === 'insertCompositionText') return;
            if (editor.getAttribute('contenteditable') !== 'true') return;
            var inside = caretHost();
            if (!inside) return;
            placeCaretAfter(inside);
        });
        editor.addEventListener('compositionstart', function () {
            if (editor.getAttribute('contenteditable') !== 'true') return;
            var inside = caretHost();
            if (inside) placeCaretAfter(inside);
        });

        /* Ctrl/Cmd + B/I/U */
        editor.addEventListener('keydown', function (e) {
            if (handleFormulaKeys(editor, e)) return;
            if (handleTableDelete(editor, e)) return;
            if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
            var k = e.key ? e.key.toLowerCase() : '';
            var map = { b: 'bold', i: 'italic', u: 'underline' };
            if (!map[k]) return;
            e.preventDefault();
            restoreRange(editor);
            try { document.execCommand(map[k], false, null); } catch (x) {}
            syncFmt(bar);
        });

        /* 记光标 + 粘贴图片。lastEdAct 用来区分「真的在笔记框里动过」和「外面飘来的空光标」 */
        ['click', 'keyup', 'mouseup', 'touchend', 'input'].forEach(function (ev) {
            editor.addEventListener(ev, function () {
                lastEdAct = Date.now();
                rememberRange(editor);
            });
        });
        editor.addEventListener('paste', function (e) {
            var items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (var i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.indexOf('image/') === 0) {
                    e.preventDefault();
                    readAndInsertImage(area, editor, items[i].getAsFile());
                    break;
                }
            }
        });

        /* 点图片：编辑态 → 选中调尺寸；非编辑态 → 浮层预览 */
        area.addEventListener('click', function (e) {
            var img = e.target.closest && e.target.closest('.note-editor img');
            if (!img) return;
            e.stopPropagation();
            var editing = editor.getAttribute('contenteditable') === 'true';
            if (editing) {
                editor.querySelectorAll('img').forEach(function (i) { i.classList.remove('rte-sel'); });
                img.classList.add('rte-sel');
                openImgCtl(area, editor, img);
            } else {
                openViewer(img.src);
            }
        }, true);
    }

    function syncFmt(bar) {
        ['bold', 'italic', 'underline'].forEach(function (cmd) {
            var b = bar.querySelector('button[data-cmd="' + cmd + '"]');
            if (!b) return;
            var on = false;
            try { on = document.queryCommandState(cmd); } catch (e) {}
            b.classList.toggle('on', !!on);
        });
    }

    function pickImage(cb) {
        var inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.style.display = 'none';
        document.body.appendChild(inp);
        inp.onchange = function () {
            if (this.files && this.files[0]) cb(this.files[0]);
            document.body.removeChild(inp);
        };
        inp.click();
    }

    function readAndInsertImage(area, editor, file) {
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
            var img = document.createElement('img');
            img.src = ev.target.result;
            img.alt = '笔记图片';
            img.__origSrc = ev.target.result;
            img.dataset.noteImg = 'true';
            var probe = new Image();
            probe.onload = function () {
                img.__pxW = probe.naturalWidth || 0;
                img.__pxH = probe.naturalHeight || 0;
                img.__origW = img.__pxW; img.__origH = img.__pxH;   /* 原图尺寸，压缩后也不改 */
                var backW = editor.clientWidth || 800;
                var want = Math.max(60, Math.min(620, Math.round(backW * 0.5)));
                if (img.__pxW) want = Math.min(want, img.__pxW);
                img.style.width = want + 'px';
                img.style.maxWidth = 'none';
                img.style.height = 'auto';
            };
            probe.src = ev.target.result;
            shrinkImage(img, ev.target.result);
            insertNodeAtCursor(editor, img);
            showTip('图片已插入 · 点图片可调尺寸，点「确认压缩」会真的压小');
        };
        reader.readAsDataURL(file);
    }

    /* ======================= K. 观察页面，自动挂载 ========================= */
    function scan() {
        document.querySelectorAll('.card-note-area').forEach(attach);
    }

    /* 26/09/21 第 35 轮：子页自己的「保存」按钮（.note-save）保存时只把 innerHTML 存进
       localStorage，不会重新渲染公式 —— 于是笔记里一直是 $$…$$ 源码，要刷新页面才变公式。
       这里补一次：点完保存（等它自己的处理跑完）就把该条笔记的公式重新渲染一遍。 */
    function hookNativeSave() {
        /* 必须用捕获阶段：子页的保存按钮委托挂在卡片容器上，handler 里调了
           e.stopPropagation()，冒泡阶段的 document 监听收不到这个 click。
           捕获阶段先拿到事件，再用 setTimeout 等它自己的保存逻辑（同步）跑完。 */
        document.addEventListener('click', function (e) {
            var b = e.target && e.target.closest ? e.target.closest('.note-save') : null;
            if (!b) return;
            var id = b.getAttribute('data-id');
            setTimeout(function () {
                var ed = document.querySelector('.note-editor[data-id="' + id + '"]');
                if (ed && ed.getAttribute('contenteditable') !== 'true') renderMathIn(ed);
            }, 80);
        }, true);
    }

    function start() {
        injectStyle();
        scan();
        hookNativeSave();
        var mo = new MutationObserver(function () { scan(); });
        mo.observe(document.body, { childList: true, subtree: true });
        /* 老笔记里的公式也渲染一遍 */
        setTimeout(function () {
            document.querySelectorAll('.note-editor').forEach(function (ed) {
                if (ed.getAttribute('contenteditable') !== 'true') renderMathIn(ed);
            });
        }, 400);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    window.__richNote = {
        attach: attach,
        renderMathIn: renderMathIn,
        openViewer: openViewer
    };
})();
