(function () {
  'use strict';
  if (window.__AI_ASSISTANT_LOADED__) return;
  window.__AI_ASSISTANT_LOADED__ = true;

  /* ---------- 预加载 KaTeX ---------- */
  var katexReady = false;
  (function loadKatex() {
    if (window.katex) { katexReady = true; return; }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    document.head.appendChild(link);
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
    s.onload = function () {
      katexReady = true;
      if (window.__AI_RERENDER__) window.__AI_RERENDER__();
    };
    document.head.appendChild(s);
  })();

  /* ---------- 样式 ---------- */
  var CSS = `
/* ===== 浮动按钮 ===== */
.ai-fab{
  position:fixed;right:22px;bottom:22px;z-index:900;
  width:58px;height:58px;border-radius:50%;
  cursor:pointer;background:#ffffff;
  border:2.5px solid #b3e0c6;
  box-shadow:0 3px 10px rgba(63,168,122,.12);
  color:#48a888;
  display:flex;align-items:center;justify-content:center;
  transition:transform .2s, box-shadow .25s, border-color .25s, color .25s;
  padding:0;
}
.ai-fab::before{
  content:'';position:absolute;inset:5px;border-radius:50%;
  border:1.4px dashed #b3e0c6;pointer-events:none;
  transition:border-color .25s;
}
.ai-fab svg{position:relative;z-index:2;width:23px;height:23px;display:block;}
.ai-fab:hover{transform:scale(1.06);border-color:#8ed4b0;color:#3fa87a;box-shadow:0 5px 16px rgba(63,168,122,.2);}
.ai-fab:hover::before{border-color:#8ed4b0;}
.ai-fab:active{transform:scale(.96);}
.ai-fab.hidden{opacity:0;pointer-events:none;transform:scale(.5);}

/* ===== 面板 ===== */
.ai-panel{position:fixed;right:22px;bottom:22px;z-index:950;width:min(440px,calc(100vw - 32px));height:min(660px,calc(100vh - 44px));background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(30,70,45,.22),0 0 0 1px rgba(180,220,200,.4);display:flex;flex-direction:column;overflow:hidden;opacity:0;pointer-events:none;transform:translateY(20px) scale(.96);transition:opacity .25s,transform .3s cubic-bezier(.34,1.56,.64,1);}
.ai-panel.show{opacity:1;pointer-events:auto;transform:translateY(0) scale(1);}

.ai-resize{position:absolute;left:0;top:0;width:34px;height:34px;cursor:nwse-resize;z-index:20;border-radius:20px 0 0 0;transition:background .15s;}
.ai-resize:hover{background:rgba(94,201,154,.10);}
.ai-resize.dragging{background:rgba(94,201,154,.20);}

.ai-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:linear-gradient(135deg,#eaf8f2,#dff2e8);border-bottom:1px solid #e0efe6;}
.ai-head-l{display:flex;align-items:center;gap:9px;font-weight:700;color:#1e4a2a;font-size:14.5px;padding-left:10px;}
.ai-dot{width:9px;height:9px;border-radius:50%;background:#3fae8c;box-shadow:0 0 0 3px rgba(63,174,140,.2);}
.ai-head-r{display:flex;gap:4px;}
.ai-head-r button{width:32px;height:32px;border:none;background:transparent;cursor:pointer;border-radius:9px;color:#5a8068;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s;}
.ai-head-r button:hover{background:#d3ecdf;color:#1e4a2a;}
.ai-config{flex:1;overflow-y:auto;padding:22px 20px;display:flex;flex-direction:column;gap:14px;background:#fbfefc;}
.ai-config.hide{display:none;}
.ai-cfg-title{font-size:15px;font-weight:700;color:#1e4a2a;}
.ai-cfg-desc{font-size:12.5px;color:#7a9a85;line-height:1.7;}
.ai-cfg-field{display:flex;flex-direction:column;gap:6px;}
.ai-cfg-field label{font-size:12.5px;font-weight:600;color:#3a6a4a;}
.ai-cfg-field select,.ai-cfg-field input,.ai-cfg-field textarea{width:100%;padding:10px 13px;border:1.5px solid #d8ebdf;border-radius:11px;background:#fff;font-size:13.5px;color:#1e3a2a;font-family:inherit;outline:none;transition:.2s;}
.ai-cfg-field select:focus,.ai-cfg-field input:focus,.ai-cfg-field textarea:focus{border-color:#5ec99a;box-shadow:0 0 0 3px rgba(94,201,154,.16);}
.ai-cfg-field textarea{resize:vertical;min-height:64px;line-height:1.6;}
.ai-cfg-hint{font-size:11.5px;color:#9ab5a5;line-height:1.6;}
.ai-save{margin-top:6px;padding:12px;border:none;border-radius:12px;background:linear-gradient(135deg,#5ec99a,#3fa87a);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(63,168,122,.28);}
.ai-save:hover{filter:brightness(1.05);}
.ai-body{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;position:relative;}
.ai-body.hide{display:none;}

/* ===== 消息区（右侧留 44px 给进度条） ===== */
.ai-msgs{flex:1;overflow-y:auto;padding:16px 44px 6px 16px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth;}
.ai-msgs::-webkit-scrollbar{width:6px;}
.ai-msgs::-webkit-scrollbar-thumb{background:#c9e4d5;border-radius:10px;}

.ai-msg{position:relative;max-width:88%;padding:10px 14px;border-radius:14px;font-size:13.8px;line-height:1.72;word-break:break-word;animation:aiMsgIn .28s ease;}
@keyframes aiMsgIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
.ai-msg.user{align-self:flex-end;background:linear-gradient(135deg,#5ec99a,#3fa87a);color:#fff;border-bottom-right-radius:4px;box-shadow:0 3px 10px rgba(63,168,122,.22);}
.ai-msg.ai{align-self:flex-start;background:#f3faf6;color:#1c3322;border:1px solid #e2f0e8;border-bottom-left-radius:4px;}
.ai-msg.sys{align-self:center;font-size:12px;color:#a0b8ab;padding:4px 10px;text-align:center;}
.ai-msg.err{align-self:stretch;max-width:100%;background:#fdf2ee;color:#c2563a;border:1px solid #f8ddd4;font-size:12.5px;line-height:1.7;}
.ai-cursor{display:inline-block;width:7px;height:15px;background:#3fa87a;border-radius:2px;margin-left:2px;vertical-align:text-bottom;animation:aiCursor 1s steps(1) infinite;}
@keyframes aiCursor{0%,50%{opacity:1}51%,100%{opacity:0}}

/* ===== 消息操作按钮 ===== */
.ai-msg-actions{position:absolute;bottom:5px;right:5px;display:flex;gap:4px;opacity:0;pointer-events:none;transition:opacity .15s;z-index:3;}
.ai-msg:hover .ai-msg-actions{opacity:1;pointer-events:auto;}
.ai-act-btn{width:24px;height:24px;border:none;background:rgba(255,255,255,.85);border-radius:7px;cursor:pointer;color:#6a8f76;display:flex;align-items:center;justify-content:center;padding:0;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);box-shadow:0 1px 4px rgba(0,0,0,.06);transition:background .15s, color .15s, transform .15s;}
.ai-act-btn svg{width:13px;height:13px;display:block;pointer-events:none;}
.ai-act-btn:hover{background:#eaf8f2;color:#3fa87a;transform:scale(1.08);}
.ai-act-btn:active{transform:scale(.94);}
.ai-act-copy.copied{background:#d8f0e4;color:#2a8a5e;}
.ai-act-regen:hover{background:#eef5fb;color:#4a86b8;}
.ai-act-del:hover{background:#fdecec;color:#c25a5a;}
.ai-msg.user .ai-act-btn{background:rgba(255,255,255,.28);color:#fff;box-shadow:none;}
.ai-msg.user .ai-act-btn:hover{background:rgba(255,255,255,.45);color:#fff;}
.ai-msg.user .ai-act-copy.copied{background:rgba(255,255,255,.5);color:#fff;}

/* ===== 对话进度条 ===== */
.ai-progress{
  position:absolute;
  right:12px;
  top:50%;
  transform:translateY(-50%);
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:0;
  padding:6px 0;
  z-index:10;
  pointer-events:auto;
}
.ai-tick{
  position:relative;
  z-index:5;
  width:16px;
  height:24px;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
}
.ai-tick::after{
  content:'';
  display:block;
  width:12px;height:2.5px;
  border-radius:2px;
  background:#cfe4d8;
  transition:width .18s, background .18s;
}
.ai-tick:hover::after{width:18px;background:#5ec99a;}
.ai-tick.active::after{width:18px;background:#3fa87a;}

.ai-progress-panel{
  position:absolute;
  right:-8px;
  top:0;                                  /* ← 由 50% 改成 0 */
  transform:translateX(8px);              /* ← 去掉 translateY(-50%) */
  width:270px;
  max-height:100%;                        /* ← 新增，防止溢出 */
  background:#ffffff;
  border-radius:14px;
  box-shadow:0 12px 40px rgba(30,70,45,.16), 0 0 0 1px rgba(180,220,200,.35);
  opacity:0;
  pointer-events:none;
  transition:opacity .18s, transform .18s;
  z-index:1;
  overflow:hidden;
}
.ai-progress-panel.show{
  opacity:1;pointer-events:auto;
  transform:translateX(0);                /* ← 去掉 translateY(-50%) */
}
.ai-progress-panel-inner{
  max-height:340px;
  overflow-y:auto;
  padding:6px 0;
}
.ai-progress-panel-inner::-webkit-scrollbar{width:5px;}
.ai-progress-panel-inner::-webkit-scrollbar-thumb{background:#cfe8db;border-radius:10px;}

.ai-progress-item{
  height:24px;
  padding:0 34px 0 14px;
  font-size:12.5px;
  line-height:24px;
  color:#3a5a48;
  cursor:pointer;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  border-left:2px solid transparent;
  transition:background .12s, color .12s, border-color .12s;
}
.ai-progress-item:hover{background:#f0faf5;color:#1e4a2a;}
.ai-progress-item.active{
  color:#2a8a5e;
  border-left-color:#3fa87a;
  background:#eaf8f2;
  font-weight:600;
}

/* ===== Markdown 元素 ===== */
.ai-msg.ai p{margin:0 0 .55em 0;}
.ai-msg.ai p:last-child{margin-bottom:0;}
.ai-msg.ai h3,.ai-msg.ai h4,.ai-msg.ai h5{color:#1e5a3a;font-weight:700;margin:.7em 0 .35em;line-height:1.4;}
.ai-msg.ai h3{font-size:15px;}
.ai-msg.ai h4{font-size:14.2px;}
.ai-msg.ai h5{font-size:13.6px;}
.ai-msg.ai h3:first-child,.ai-msg.ai h4:first-child,.ai-msg.ai h5:first-child{margin-top:0;}
.ai-msg.ai ul,.ai-msg.ai ol{margin:.3em 0 .55em 0;padding-left:1.5em;}
.ai-msg.ai li{margin:.18em 0;line-height:1.72;}
.ai-msg.ai code{background:#e4f4ea;padding:1px 6px;border-radius:5px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.8px;color:#2a6a4a;word-break:break-word;}
.ai-msg.ai pre.ai-code{background:#eaf5ee;border:1px solid #d8ecdf;border-radius:10px;padding:10px 12px;margin:.45em 0;overflow-x:auto;font-size:12.6px;line-height:1.6;}
.ai-msg.ai pre.ai-code code{background:transparent;padding:0;font-size:12.6px;color:#1f4a34;display:block;white-space:pre;}
.ai-msg.ai strong{color:#1e5a3a;font-weight:700;}
.ai-msg.ai blockquote{margin:.55em 0;padding:9px 14px;background:#eef8f2;border-left:3px solid #7fd0a8;border-radius:7px;color:#2a5a3a;}
.ai-msg.ai blockquote p{margin:0 0 .35em 0;}
.ai-msg.ai blockquote p:last-child{margin-bottom:0;}
.ai-msg.ai .ai-formula-block{display:block;margin:.7em 0;padding:8px 12px;background:#fbfefc;border:1px solid #e2f0e8;border-radius:10px;text-align:center;overflow-x:auto;overflow-y:hidden;}
.ai-msg.ai .ai-formula-block .katex-display{margin:0;}
.ai-msg.ai .katex{font-size:1.02em;}
.ai-formula-fallback{background:#fff3e0;color:#a86a1f;padding:1px 6px;border-radius:5px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;}
.ai-table-wrap{overflow-x:auto;margin:.55em 0;border-radius:10px;border:1px solid #d8ecdf;}
.ai-msg.ai .ai-table{width:100%;border-collapse:collapse;font-size:13px;line-height:1.55;}
.ai-msg.ai .ai-table th,
.ai-msg.ai .ai-table td{padding:7px 11px;border-bottom:1px solid #e5f2ea;border-right:1px solid #e5f2ea;text-align:left;vertical-align:top;word-break:break-word;}
.ai-msg.ai .ai-table th:last-child,
.ai-msg.ai .ai-table td:last-child{border-right:none;}
.ai-msg.ai .ai-table tbody tr:last-child td{border-bottom:none;}
.ai-msg.ai .ai-table th{background:#eaf8f2;color:#1e5a3a;font-weight:700;white-space:nowrap;}
.ai-msg.ai .ai-table tbody tr:nth-child(even) td{background:#fafdfc;}

.ai-input-wrap{flex:0 0 auto;padding:10px 12px 12px;border-top:1px solid #e8f2ec;background:#fbfefc;display:flex;gap:8px;align-items:flex-end;}
.ai-input-wrap textarea{flex:1;min-height:42px;max-height:140px;padding:10px 14px;border:1.5px solid #d8ebdf;border-radius:14px;background:#fff;font-size:13.8px;color:#1e3a2a;font-family:inherit;line-height:1.55;resize:none;outline:none;overflow-y:auto;}
.ai-input-wrap textarea:focus{border-color:#5ec99a;box-shadow:0 0 0 3px rgba(94,201,154,.15);}
.ai-input-wrap textarea::placeholder{color:#a8c2b4;}
.ai-send{flex:0 0 auto;width:46px;height:46px;border-radius:14px;border:none;background:linear-gradient(135deg,#5ec99a,#3fa87a);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(63,168,122,.28);}
.ai-send:hover{filter:brightness(1.06);}
.ai-send svg{width:20px;height:20px;display:block;}
.ai-send.stop{
  background:linear-gradient(135deg,#fff4c9,#ffe08a);
  color:#8a6a1a;
  box-shadow:0 4px 12px rgba(214,168,60,.28);
}

@media (max-width:640px){
  .ai-fab{right:16px;bottom:16px;width:52px;height:52px;border-width:2px;}
  .ai-fab::before{inset:4px;}
  .ai-fab svg{width:21px;height:21px;}
  .ai-panel{
    right:0;bottom:0;top:0;left:0;
    width:auto !important;height:auto !important;max-height:none !important;
    border-radius:0;
    padding-top:env(safe-area-inset-top, 0px);
    padding-bottom:env(safe-area-inset-bottom, 0px);
  }
  .ai-resize{display:none;}
  .ai-msg{max-width:92%;font-size:14px;}
  .ai-msgs{padding:16px 34px 6px 16px;}
  .ai-msg-actions{opacity:.7;pointer-events:auto;}
  .ai-act-btn{width:26px;height:26px;}
  .ai-progress{right:6px;padding:4px 0;}
  .ai-tick{width:14px;height:22px;}
  .ai-tick::after{width:10px;height:2px;}
  .ai-tick:hover::after,.ai-tick.active::after{width:14px;}
  .ai-progress-panel{display:none;}
  .ai-input-wrap{padding:8px 10px calc(8px + env(safe-area-inset-bottom));}
}`;
  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ---------- HTML ---------- */
  var HTML = ''
    + '<button class="ai-fab" id="aiFab" title="AI 答疑助手">'
    +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    +     '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
    +     '<circle cx="9" cy="10" r="1" fill="currentColor"/>'
    +     '<circle cx="15" cy="10" r="1" fill="currentColor"/>'
    +   '</svg>'
    + '</button>'
    + '<div class="ai-panel" id="aiPanel">'
    +   '<div class="ai-resize" id="aiResize" title="拖动调整大小"></div>'
    +   '<div class="ai-head">'
    +     '<div class="ai-head-l"><span class="ai-dot"></span><span id="aiHeadTitle">AI 答疑助手</span></div>'
    +     '<div class="ai-head-r">'
    +       '<button id="aiClear" title="清空对话"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>'
    +       '<button id="aiSetting" title="设置"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>'
    +       '<button id="aiClose" title="关闭"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>'
    +     '</div>'
    +   '</div>'
    +   '<div class="ai-config" id="aiConfig">'
    +     '<div class="ai-cfg-title">🔧 首次使用，先配置 API</div>'
    +     '<div class="ai-cfg-desc">所有配置仅保存在你自己的浏览器本地。</div>'
    +     '<div class="ai-cfg-field"><label>服务商</label><select id="cfgPreset"></select><div class="ai-cfg-hint" id="cfgPresetHint"></div></div>'
    +     '<div class="ai-cfg-field"><label>API 地址（Base URL）</label><input type="text" id="cfgBase" placeholder="https://api.deepseek.com/v1" /></div>'
    +     '<div class="ai-cfg-field"><label>模型名称</label><input type="text" id="cfgModel" placeholder="deepseek-chat" /></div>'
    +     '<div class="ai-cfg-field"><label>API Key</label><input type="password" id="cfgKey" placeholder="sk-..." autocomplete="off" /><div class="ai-cfg-hint">🔒 只存在你本地浏览器</div></div>'
    +     '<div class="ai-cfg-field"><label>系统提示词（可改）</label><textarea id="cfgSystem" rows="10"></textarea></div>'
    +     '<button class="ai-save" id="aiSaveCfg">保存并开始使用</button>'
    +   '</div>'
    +   '<div class="ai-body hide" id="aiBody">'
    +     '<div class="ai-msgs" id="aiMsgs"></div>'
    +     '<div class="ai-progress" id="aiProgress">'
    +       '<div class="ai-progress-panel" id="aiProgressPanel">'
    +         '<div class="ai-progress-panel-inner" id="aiProgressPanelInner"></div>'
    +       '</div>'
    +     '</div>'
    +     '<div class="ai-input-wrap">'
    +       '<textarea id="aiInput" rows="1" placeholder="输入问题…（Enter 发送，Shift+Enter 换行）"></textarea>'
    +       '<button class="ai-send" id="aiSend" title="发送"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  var holder = document.createElement('div');
  holder.innerHTML = HTML;
  while (holder.firstChild) document.body.appendChild(holder.firstChild);

  /* ---------- 配置数据 ---------- */
  var PRESETS = {
    deepseek: { name: 'DeepSeek（推荐）', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', hint: '便宜好用 → platform.deepseek.com' },
    zhipu:    { name: '智谱 GLM',       base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', hint: 'glm-4-flash 免费 → open.bigmodel.cn' },
    qwen:     { name: '通义千问',       base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', hint: '阿里云 → dashscope.aliyun.com' },
    moonshot: { name: 'Kimi (Moonshot)', base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', hint: '长文本 → platform.moonshot.cn' },
    custom:   { name: '自定义（OpenAI 兼容）', base: '', model: '', hint: '兼容 /chat/completions 的接口' }
  };

  var SYS_VER = 'v3';

  var DEFAULT_SYSTEM = [
    '你是南开大学经济学考研（847经济学）的专属答疑助手，只讲微观经济学和宏观经济学两门课。',
    '',
    '【覆盖范围】',
    '微观：消费者行为、生产者行为、完全竞争/垄断/垄断竞争/寡头、博弈论、要素市场、一般均衡与福利经济学、市场失灵。',
    '宏观：宏观经济数据、IS-LM、AD-AS、开放经济、失业与通胀、菲利普斯曲线、经济增长、宏观经济政策争论、宏观流派、消费与投资微观基础。',
    '',
    '【不涉及】',
    '政治经济学、计量经济学、金融学专业课内容。',
    '',
    '【回答方式】',
    '（1）概念类：先给精准定义，再讲经济学直觉，必要时画图或列式，最后给考研答题要点。',
    '（2）推导类：分步推导，每步标注依据，关键结论加粗。',
    '（3）计算类：按"列式 → 求解 → 说明经济含义"三步走，标注易错点。',
    '（4）对比类：必须用表格。',
    '（5）答题类：按"总—分—总"给框架。',
    '',
    '【格式要求（必须遵守）】',
    '· 所有数学符号和公式必须用 LaTeX 语法：',
    '  - 行内公式：$P = MR$、$MRS_{xy} = P_x/P_y$、$u = x^a y^b$',
    '  - 独立公式：$$MR = P\\left(1 - \\frac{1}{|e_d|}\\right)$$',
    '· 绝对不要用 Unicode 符号拼公式（不要写 ⋅ ≤ ∞ ∑ ∂ π α 这种），一律用 LaTeX',
    '· 比较运算符 >、<、≥、≤ 在公式内直接用 >、<、\\geq、\\leq，不要写 &gt; &lt;',
    '· 对比、分类、总结类信息用 Markdown 表格',
    '· 小标题用 ## 或 ###，要点如要分层级用（1）、①、a.（优先下述编号格式），关键词用 **加粗**',
    '· 不要输出 --- 这种分割线，用空行或小标题分隔章节即可',
    '',
    '【编号格式（必须严格遵守，不允许例外）】',
    '分点回答时，绝对禁止使用任何 Markdown 列表符号：',
    '· 不要用 "- "、"* "、"+" 开头',
    '· 不要用 "1. "、"2. "、"3. " 开头',
    '· 不要用 "1、2、3、" 开头',
    '一律改用中文括号编号，格式如下：',
    '（1）第一点内容，单独成段。',
    '（2）第二点内容，单独成段。',
    '（3）第三点内容，单独成段。',
    '不够用的情况用①②③、a.b.c.或者罗马数字也是被允许的。',
    '这样可以避免在渲染时产生多余空行。小标题仍可用 ## 或 ###，加粗仍可用 **加粗**，公式仍用 $...$ 或 $$...$$。',
    '',
    '【学习辅助】',
    '- 遇到典型题型，主动提"这是南开真题常考风格"或"这是XX名校真题"',
    '- 遇到容易混淆的概念，主动做对比',
    '- 遇到高频考点，主动提醒"这是高频考点，结论要背下来"',
    '',
    '【风格】',
    '简洁、直击要点、有分寸感。不啰嗦、不注水、不重复用户的话。学术严谨，但语气亲切。'
  ].join('\n');

  var STORAGE_KEY = 'ai_assistant_cfg_v1';
  var HISTORY_KEY = 'ai_assistant_history_v1';
  var SIZE_KEY    = 'ai_assistant_size_v1';
  var SYS_VER_KEY = 'ai_assistant_sys_ver';

  var $ = function (id) { return document.getElementById(id); };
  var fab = $('aiFab'), panel = $('aiPanel'), closeBtn = $('aiClose'),
      clearBtn = $('aiClear'), settingBtn = $('aiSetting'),
      resizeHandle = $('aiResize'),
      configEl = $('aiConfig'), bodyEl = $('aiBody'),
      msgsEl = $('aiMsgs'), inputEl = $('aiInput'), sendBtn = $('aiSend'),
      headTitle = $('aiHeadTitle'),
      cfgPreset = $('cfgPreset'), cfgPresetHint = $('cfgPresetHint'),
      cfgBase = $('cfgBase'), cfgModel = $('cfgModel'),
      cfgKey = $('cfgKey'), cfgSystem = $('cfgSystem'),
      saveCfgBtn = $('aiSaveCfg');

  var cfg = loadCfg();
  var history = loadHistory();
  var controller = null;
  var isStreaming = false;
  var stickBottom = true;
  var savedScrollTop = null;

  function loadCfg() {
    try { var r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch (e) {}
    return { preset: 'deepseek', base: '', model: '', key: '', system: DEFAULT_SYSTEM };
  }
  function saveCfg() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (e) {} }

  (function autoUpgradeSystem() {
    try {
      var savedVer = localStorage.getItem(SYS_VER_KEY);
      if (savedVer !== SYS_VER) {
        cfg.system = DEFAULT_SYSTEM;
        saveCfg();
        localStorage.setItem(SYS_VER_KEY, SYS_VER);
      }
    } catch (e) {}
  })();

  function loadHistory() {
    try { var r = localStorage.getItem(HISTORY_KEY); if (r) return JSON.parse(r) || []; } catch (e) {}
    return [];
  }
  function saveHistory() {
    try { if (history.length > 40) history = history.slice(-40); localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e) {}
  }

  /* ---------- 面板尺寸记忆 ---------- */
  function applySavedSize() {
    if (window.innerWidth <= 640) return;
    try {
      var s = JSON.parse(localStorage.getItem(SIZE_KEY) || 'null');
      if (s && s.w && s.h) {
        panel.style.width = Math.min(s.w, window.innerWidth - 20) + 'px';
        panel.style.height = Math.min(s.h, window.innerHeight - 20) + 'px';
      }
    } catch (e) {}
  }
  function saveSize() {
    if (window.innerWidth <= 640) return;
    try {
      var rect = panel.getBoundingClientRect();
      localStorage.setItem(SIZE_KEY, JSON.stringify({ w: Math.round(rect.width), h: Math.round(rect.height) }));
    } catch (e) {}
  }

  /* ---------- 拖拽调整大小 ---------- */
  function startResize(e) {
    if (window.innerWidth <= 640) return;
    e.preventDefault(); e.stopPropagation();

    var rect = panel.getBoundingClientRect();
    var startX = e.clientX, startY = e.clientY;
    var startW = rect.width, startH = rect.height;
    var minW = 300, minH = 380;

    resizeHandle.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'nwse-resize';

    function onMove(ev) {
      var dx = ev.clientX - startX;
      var dy = ev.clientY - startY;
      var w = Math.max(minW, Math.min(startW - dx, window.innerWidth - 20));
      var h = Math.max(minH, Math.min(startH - dy, window.innerHeight - 20));
      panel.style.width = w + 'px';
      panel.style.height = h + 'px';
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      resizeHandle.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      saveSize();
      setTimeout(buildNav, 50);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }
  resizeHandle.addEventListener('pointerdown', startResize);

  window.addEventListener('resize', function () {
    if (window.innerWidth <= 640) {
      panel.style.width = ''; panel.style.height = '';
      return;
    }
    var rect = panel.getBoundingClientRect();
    if (rect.width > window.innerWidth - 20) panel.style.width = (window.innerWidth - 20) + 'px';
    if (rect.height > window.innerHeight - 20) panel.style.height = (window.innerHeight - 20) + 'px';
  });

  /* ---------- 配置界面 ---------- */
  function initPresetSelect() {
    cfgPreset.innerHTML = Object.keys(PRESETS).map(function (k) {
      return '<option value="' + k + '">' + PRESETS[k].name + '</option>';
    }).join('');
    cfgPreset.value = cfg.preset || 'deepseek';
  }
  cfgPreset.addEventListener('change', function () {
    var p = PRESETS[cfgPreset.value]; if (!p) return;
    cfgBase.value = p.base || ''; cfgModel.value = p.model || ''; cfgPresetHint.textContent = p.hint || '';
  });
  function fillConfigForm() {
    cfgPreset.value = cfg.preset || 'deepseek';
    var p = PRESETS[cfgPreset.value] || {};
    cfgBase.value = cfg.base || p.base || '';
    cfgModel.value = cfg.model || p.model || '';
    cfgKey.value = cfg.key || '';
    cfgSystem.value = cfg.system || DEFAULT_SYSTEM;
    cfgPresetHint.textContent = p.hint || '';
  }
  function showConfig() {
    configEl.classList.remove('hide'); bodyEl.classList.add('hide');
    headTitle.textContent = 'AI 答疑助手 · 设置'; fillConfigForm();
  }
    function showChat() {
    configEl.classList.add('hide'); bodyEl.classList.remove('hide');
    headTitle.textContent = 'AI 答疑助手';

    // 先禁用自动滚底，避免 renderHistory 把位置重置到底部
    stickBottom = false;
    renderHistory();

    setTimeout(function () {
      try {
        if (savedScrollTop !== null) {
          msgsEl.scrollTop = savedScrollTop;
        } else {
          msgsEl.scrollTop = msgsEl.scrollHeight;
        }
        var gap = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight;
        stickBottom = gap < 60;
      } catch (e) {}
      inputEl.focus();
      buildNav();
    }, 120);
  }
  function hasValidCfg() { return cfg.key && cfg.base && cfg.model; }

  function openPanel() {
    panel.classList.add('show'); fab.classList.add('hidden');
    applySavedSize();
    if (hasValidCfg()) showChat(); else showConfig();
    setTimeout(buildNav, 260);
  }
  function closePanel() {
    panel.classList.remove('show');
    fab.classList.remove('hidden');    // ← remove
    stopStream();
    try { savedScrollTop = msgsEl.scrollTop; } catch (e) {}
}

  fab.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);
  settingBtn.addEventListener('click', function () {
    if (configEl.classList.contains('hide')) showConfig();
    else if (hasValidCfg()) showChat();
  });
  clearBtn.addEventListener('click', function () {
    if (!history.length) return;
    if (!confirm('确定清空所有对话记录吗？')) return;
    history = []; saveHistory(); renderHistory(); showToast('已清空对话');
  });

  saveCfgBtn.addEventListener('click', function () {
    var base = cfgBase.value.trim().replace(/\/+$/, '');
    var model = cfgModel.value.trim();
    var key = cfgKey.value.trim();
    var system = cfgSystem.value.trim() || DEFAULT_SYSTEM;
    if (!base) { alert('请填写 API 地址'); return; }
    if (!model) { alert('请填写模型名称'); return; }
    if (!key) { alert('请填写 API Key'); return; }
    cfg = { preset: cfgPreset.value, base: base, model: model, key: key, system: system };
    saveCfg(); showChat(); showToast('配置已保存 ✓');
  });

  /* ===================== 读取页面上下文 ===================== */

  /* 追踪"最近展开的卡片"：点开答案/笔记区的那张作为"当前卡" */
  var lastOpenedCardId = null;

  document.addEventListener('click', function (e) {
    var q = e.target.closest && e.target.closest('.card-question');
    if (!q) return;
    var card = q.closest('.card-item');
    if (!card || !card.dataset.id) return;
    var id = card.dataset.id;
    // 等页面自己的 click 处理跑完，再检查展开状态
       setTimeout(function () {
      var isOpen = !!card.querySelector('.card-answer.open, .card-note-area.open');
      if (isOpen) {
        lastOpenedCardId = id;
        return;
      }
      // 收回的是当前卡：看视口里还有没有别的展开的卡，有就顶替
      if (lastOpenedCardId === id) {
        lastOpenedCardId = null;
        var vh = window.innerHeight, vw = window.innerWidth;
        var all = document.querySelectorAll('.card-item');
        for (var i = 0; i < all.length; i++) {
          var it = all[i];
          if (it.dataset.id === id) continue;
          if (!it.querySelector('.card-answer.open, .card-note-area.open')) continue;
          var r = it.getBoundingClientRect();
          if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
          lastOpenedCardId = it.dataset.id;
          break;
        }
      }
    }, 0);
  }, true);

  function buildPageContext() {
    var ctx = '';
    var h1 = document.querySelector('.app-header h1, header h1, h1');
    var pageTitle = h1 ? h1.textContent.replace(/^[^\u4e00-\u9fa5A-Za-z]+/, '').trim() : '';
    if (pageTitle) ctx += '【当前模块】' + pageTitle + '\n';
    ctx += '【★★★ 下面"用户正在查看的内容"是用户此刻屏幕上实际显示的卡片，以它为准；历史对话中若涉及其他题号，请忽略，不要再回答旧题。★★★】\n';

    var vh = window.innerHeight;
    var vw = window.innerWidth;

    /* 收集所有卡片（多套选择器兜底） */
    var allCards = [];
    function collect(sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
        if (allCards.indexOf(el) === -1) allCards.push(el);
      });
    }
    collect('.card-item');
    if (!allCards.length) {
      collect('[class*="card-item"]');
      collect('.question-card');
      collect('[data-card]');
    }

    /* 按"可见程度 + 离视口中心距离"打分，只挑当前屏幕上的 */
    var scored = [];
    allCards.forEach(function (item) {
      var r = item.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return;
      var visibleH = Math.min(vh, r.bottom) - Math.max(0, r.top);
      var ratio = r.height > 0 ? visibleH / r.height : 0;
      var cardCenter = (r.top + r.bottom) / 2;
      var distToCenter = Math.abs(cardCenter - vh / 2);
      // 可见比例为主，离中心近为辅
      var score = ratio * 1000 - distToCenter;
      scored.push({ el: item, score: score, ratio: ratio });
    });
    scored.sort(function (a, b) { return b.score - a.score; });

    // 如果最近展开过某张卡，且它还在视口内，就只读它
    if (lastOpenedCardId) {
      var inView = scored.some(function (sc) {
        return sc.el.dataset.id === lastOpenedCardId;
      });
      if (inView) {
        scored = scored.filter(function (sc) {
          return sc.el.dataset.id === lastOpenedCardId;
        });
      } else {
        lastOpenedCardId = null;
      }
    }

    var cards = [];
    var seenQ = {};
    scored.forEach(function (sc) {
      if (cards.length >= 3) return;
      var item = sc.el;
      var qEl = item.querySelector('.q-text');
      var q = (qEl ? qEl.textContent : '').trim();
      if (!q || seenQ[q]) return;
      seenQ[q] = 1;
      var labelEl = item.querySelector('.card-header .label');
      var label = labelEl ? labelEl.textContent.replace(/\s+/g, ' ').trim() : '';
      var aEl = item.querySelector('.card-answer.open .answer-inner');
      var a = aEl ? aEl.textContent.trim() : '';
      var nEl = item.querySelector('.card-note-area .note-editor');
      var n = nEl ? nEl.textContent.trim() : '';
      if (n && n.indexOf('点击写下笔记') > -1) n = '';
      cards.push({ label: label, q: q, a: a, n: n });
    });

    /* 兜底：视口内确实没有卡片时，才去用"最近展开过的那张" */
    if (cards.length === 0) {
      var opened = document.querySelectorAll('.card-answer.open, .card-note-area.open');
      if (opened.length) {
        var lastOpened = opened[opened.length - 1].closest('.card-item');
        if (lastOpened) {
          var qEl = lastOpened.querySelector('.q-text');
          var q = (qEl ? qEl.textContent : '').trim();
          if (q) {
            var aEl = lastOpened.querySelector('.card-answer.open .answer-inner');
            var a = aEl ? aEl.textContent.trim() : '';
            var nEl = lastOpened.querySelector('.card-note-area .note-editor');
            var n = nEl ? nEl.textContent.trim() : '';
            if (n && n.indexOf('点击写下笔记') > -1) n = '';
            cards.push({ label: '', q: q, a: a, n: n });
          }
        }
      }
    }

    if (cards.length) {
      ctx += '\n【用户正在查看的内容（屏幕上的卡片）】\n';
      cards.forEach(function (c, i) {
        ctx += '\n— 第 ' + (i + 1) + ' 张 —\n';
        if (c.label) ctx += '标签：' + c.label.slice(0, 80) + '\n';
        ctx += '题目：' + c.q.slice(0, 400) + '\n';
        if (c.a) ctx += '答案：' + c.a.slice(0, 1600) + '\n';
        if (c.n) ctx += '用户笔记：' + c.n.slice(0, 800) + '\n';
      });
    } else {
      ctx += '\n【用户当前屏幕上没有可见的卡片】\n';
    }

    var subj = document.querySelector('#filterSubject option:checked');
    var paper = document.querySelector('#filterPaper option:checked');
    if (subj && subj.value !== 'all') ctx += '\n【筛选·专业】' + subj.textContent;
    if (paper && paper.value !== 'all') ctx += '\n【筛选·套卷】' + paper.textContent;

    return ctx.trim();
  }

  /* 诊断用：在浏览器控制台输入 __AI_DIAG__() 可看当前读到的上下文 */
  window.__AI_DIAG__ = function () {
    var t = buildPageContext();
    console.log(t);
    return t;
  };

  /* ===================== 渲染工具 ===================== */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderFormula(expr, displayMode) {
    var trimmed = expr.trim();
    if (katexReady && window.katex) {
      try {
        return katex.renderToString(trimmed, {
          displayMode: displayMode, throwOnError: false, strict: false,
          trust: false, output: 'html'
        });
      } catch (e) {}
    }
    var open  = displayMode ? '$$' : '$';
    var close = displayMode ? '$$' : '$';
    return '<span class="ai-formula-fallback">' + open + escapeHtml(trimmed) + close + '</span>';
  }

  function inlineMD(text) {
    var t = text;
    t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return t;
  }

  function splitTableRow(line) {
    var s = line.trim();
    if (s.charAt(0) === '|') s = s.slice(1);
    if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1);
    return s.split('|').map(function (c) { return c.trim(); });
  }

  function renderTable(tableLines) {
    if (tableLines.length < 2) return tableLines.join('\n');
    var headerCells = splitTableRow(tableLines[0]);
    var bodyRows = tableLines.slice(2).map(splitTableRow);
    var html = '<div class="ai-table-wrap"><table class="ai-table"><thead><tr>';
    for (var i = 0; i < headerCells.length; i++) {
      html += '<th>' + inlineMD(headerCells[i]) + '</th>';
    }
    html += '</tr></thead><tbody>';
    for (var r = 0; r < bodyRows.length; r++) {
      html += '<tr>';
      for (var c = 0; c < bodyRows[r].length; c++) {
        html += '<td>' + inlineMD(bodyRows[r][c]) + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function renderMD(text) {
    if (!text) return '';
    var t = text;

    var codeBlocks = [];
    t = t.replace(/```[^\n]*\n?([\s\S]*?)```/g, function (m, code) {
      var idx = codeBlocks.length;
      codeBlocks.push(code.replace(/\n$/, ''));
      return '\u0000CB' + idx + '\u0000';
    });

    var formulas = [];
    function pushFormula(expr, display) {
      var idx = formulas.length;
      formulas.push({ expr: expr, display: display });
      return '\u0000FM' + idx + '\u0000';
    }

    t = t.replace(/\$\$([\s\S]+?)\$\$/g, function (m, expr) { return pushFormula(expr, true); });
    t = t.replace(/\\\[([\s\S]+?)\\\]/g, function (m, expr) { return pushFormula(expr, true); });
    t = t.replace(/\$([^\$\n]+?)\$/g, function (m, expr) {
      var e = expr.trim();
      if (!e) return m;
      if (/^[\d\s,\.]+$/.test(e)) return m;
      if (/^[\u4e00-\u9fa5\u3000-\u303f]+$/.test(e)) return m;
      if (e.length > 150) return m;
      return pushFormula(expr, false);
    });
    t = t.replace(/\\\(([\s\S]+?)\\\)/g, function (m, expr) { return pushFormula(expr, false); });

    t = escapeHtml(t);

    var lines = t.split('\n');
    var out = [];
    var i = 0;
    var tableRegex = /^\s*\|.*\|\s*$/;
    var sepRegex = /^\s*\|[\s\-:|]+\|\s*$/;
    var quoteRegex = /^\s*&gt;\s?(.*)$/;

    while (i < lines.length) {
      var line = lines[i];

      if (tableRegex.test(line) && i + 1 < lines.length && sepRegex.test(lines[i + 1])) {
        var tableLines = [line, lines[i + 1]];
        i += 2;
        while (i < lines.length && tableRegex.test(lines[i])) {
          tableLines.push(lines[i]);
          i++;
        }
        out.push(renderTable(tableLines));
        continue;
      }

      if (quoteRegex.test(line)) {
        var quoteLines = [];
        while (i < lines.length && quoteRegex.test(lines[i])) {
          var m = lines[i].match(quoteRegex);
          quoteLines.push(m[1]);
          i++;
        }
        out.push('<blockquote>' + quoteLines.join('<br>') + '</blockquote>');
        continue;
      }

      if (/^\s*[-*_]{3,}\s*$/.test(line)) {
        i++;
        continue;
      }

      out.push(line);
      i++;
    }
    t = out.join('\n');

    t = t.replace(/^#{4,6}\s+(.+)$/gm, '<h5>$1</h5>');
    t = t.replace(/^###\s+(.+)$/gm, '<h4>$1</h4>');
    t = t.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');
    t = t.replace(/^#\s+(.+)$/gm, '<h3>$1</h3>');

    t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    t = t.replace(/^[ \t]*[-*+]\s+(.+)$/gm, '<li>$1</li>');
    t = t.replace(/^[ \t]*\d+\.\s+(.+)$/gm, '<li>$1</li>');
    t = t.replace(/(?:<li>[\s\S]*?<\/li>\s*)+/g, function (m) {
      return '<ul>' + m.replace(/\n+/g, '') + '</ul>';
    });

    t = t.replace(/\n{2,}/g, '</p><p>');
    t = t.replace(/\n/g, '<br>');
    t = '<p>' + t + '</p>';

    t = t.replace(/\u0000FM(\d+)\u0000/g, function (m, idx) {
      var f = formulas[+idx]; if (!f) return '';
      var rendered = renderFormula(f.expr, f.display);
      return f.display ? '<div class="ai-formula-block">' + rendered + '</div>' : rendered;
    });

    t = t.replace(/\u0000CB(\d+)\u0000/g, function (m, idx) {
      var code = codeBlocks[+idx] || '';
      return '<pre class="ai-code"><code>' + escapeHtml(code) + '</code></pre>';
    });

    t = t.replace(/<p>\s*(<pre|<ul|<ol|<h[3-6]|<blockquote|<div class="ai-formula-block"|<div class="ai-table-wrap")/g, '$1');
    t = t.replace(/(<\/pre>|<\/ul>|<\/ol>|<\/h[3-6]>|<\/blockquote>|<\/div>)\s*<\/p>/g, '$1');
    t = t.replace(/<p>\s*<\/p>/g, '');
    t = t.replace(/(<(?:pre|ul|ol|h[3-6]|blockquote|div)[^>]*>)<br>/g, '$1');
    t = t.replace(/<br>(<\/(?:pre|ul|ol|h[3-6]|blockquote|div)>)/g, '$1');

    return t;
  }

  window.__AI_RERENDER__ = function () { renderHistory(); };

  /* ===================== 复制功能 ===================== */
  function copyToClipboard(text, onSuccess) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (onSuccess) onSuccess();
      }).catch(function () {
        fallbackCopy(text, onSuccess);
      });
    } else {
      fallbackCopy(text, onSuccess);
    }
  }
  function fallbackCopy(text, onSuccess) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (onSuccess) onSuccess();
    } catch (e) {}
    document.body.removeChild(ta);
  }

  var COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  var REGEN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 9"/></svg>';
  var DEL_ICON   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>';

  function attachMsgActions(div, rawText, role, idx) {
    var wrap = document.createElement('div');
    wrap.className = 'ai-msg-actions';

    var copyBtn = document.createElement('button');
    copyBtn.className = 'ai-act-btn ai-act-copy';
    copyBtn.title = '复制';
    copyBtn.innerHTML = COPY_ICON;
    copyBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      copyToClipboard(rawText, function () {
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = CHECK_ICON;
        copyBtn.title = '已复制';
        setTimeout(function () {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = COPY_ICON;
          copyBtn.title = '复制';
        }, 1400);
      });
    });
    wrap.appendChild(copyBtn);

    if (role === 'ai' && typeof idx === 'number' && idx >= 0) {
      var regenBtn = document.createElement('button');
      regenBtn.className = 'ai-act-btn ai-act-regen';
      regenBtn.title = '重新生成';
      regenBtn.innerHTML = REGEN_ICON;
      regenBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        regenerateFrom(idx);
      });
      wrap.appendChild(regenBtn);
    }

    if (typeof idx === 'number' && idx >= 0) {
      var delBtn = document.createElement('button');
      delBtn.className = 'ai-act-btn ai-act-del';
      delBtn.title = '删除这条消息';
      delBtn.innerHTML = DEL_ICON;
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteMsgAt(idx);
      });
      wrap.appendChild(delBtn);
    }

    div.appendChild(wrap);
  }

  function deleteMsgAt(idx) {
    if (isStreaming) { showToast('正在回复中，请稍候'); return; }
    if (idx < 0 || idx >= history.length) return;
    var m = history[idx];
    var preview = (m.content || '').replace(/\s+/g, ' ').slice(0, 40);
    var roleName = m.role === 'user' ? '你的提问' : 'AI 回复';
    if (!confirm('删除这条' + roleName + '？\n\n' + preview + (m.content.length > 40 ? '…' : ''))) return;
    history.splice(idx, 1);
    saveHistory();
    renderHistory();
    showToast('已删除该条消息');
  }

  function regenerateFrom(idx) {
    if (isStreaming) { showToast('正在回复中，请稍候'); return; }
    var userIdx = -1;
    for (var i = idx - 1; i >= 0; i--) {
      if (history[i].role === 'user') { userIdx = i; break; }
    }
    if (userIdx < 0) { showToast('找不到对应的提问'); return; }
    var userText = history[userIdx].content;
    history = history.slice(0, userIdx);
    saveHistory();
    renderHistory();
    inputEl.value = userText;
    send();
  }

  /* ===================== 消息创建 ===================== */
  function addMsg(role, text, idx, opts) {
    var div = document.createElement('div');
    div.className = 'ai-msg ' + role;
    if (role === 'ai') div.innerHTML = renderMD(text);
    else div.textContent = text;
    if (role === 'user') div.dataset.q = '1';
    if ((role === 'user' || role === 'ai') && typeof idx === 'number' && idx >= 0 && !(opts && opts.noActions)) {
      attachMsgActions(div, text, role, idx);
    }
    msgsEl.appendChild(div); scrollToBottom(); return div;
  }

  function scrollToBottom() {
    if (!stickBottom) return;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      msgsEl.scrollTop = msgsEl.scrollHeight;
    });
  }
  var rafPending = false;

  msgsEl.addEventListener('scroll', function () {
    var gap = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight;
    stickBottom = gap < 60;
  });

  /* ===================== 对话进度条 ===================== */
  var navUserMsgs = [];
  var navTicks = [];

  function buildNav() {
    var progress = document.getElementById('aiProgress');
    var panelInner = document.getElementById('aiProgressPanelInner');
    var panelEl = document.getElementById('aiProgressPanel');
    if (!progress) return;

    progress.querySelectorAll('.ai-tick').forEach(function (t) { t.remove(); });
    if (panelInner) panelInner.innerHTML = '';

    navUserMsgs = Array.prototype.filter.call(
      msgsEl.querySelectorAll('.ai-msg.user'),
      function (n) { return n.dataset.q; }
    );

    if (!navUserMsgs.length) return;

    navTicks = [];
    navUserMsgs.forEach(function (uNode, i) {
      var tick = document.createElement('div');
      tick.className = 'ai-tick';
      tick.dataset.idx = i;
      progress.appendChild(tick);
      navTicks.push(tick);

      if (panelInner) {
        var item = document.createElement('div');
        item.className = 'ai-progress-item';
        item.dataset.idx = i;
        item.textContent = uNode.textContent.trim().slice(0, 40) || ('提问 ' + (i + 1));
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          navScrollTo(i);
        });
        panelInner.appendChild(item);
      }
      
      tick.addEventListener('click', function (e) {
        e.stopPropagation();
        navScrollTo(i);
      });
    });

    navUpdateActive();
  }

  function navUpdateActive() {
    if (!navUserMsgs.length) return;
    var msgsRect = msgsEl.getBoundingClientRect();
    var threshold = msgsRect.top + 80;
    var activeIdx = 0;
    navUserMsgs.forEach(function (n, i) {
      var r = n.getBoundingClientRect();
      if (r.top <= threshold) activeIdx = i;
    });
    navTicks.forEach(function (t, i) {
      t.classList.toggle('active', i === activeIdx);
    });
    var panelInner = document.getElementById('aiProgressPanelInner');
    if (panelInner) {
      panelInner.querySelectorAll('.ai-progress-item').forEach(function (it, i) {
        it.classList.toggle('active', i === activeIdx);
      });
    }
  }

  function navScrollTo(i) {
    var node = navUserMsgs[i];
    if (!node) return;
    stickBottom = false;

    // 临时关掉 CSS 平滑，瞬间定位，绝无抖动
    var oldBehavior = msgsEl.style.scrollBehavior;
    msgsEl.style.scrollBehavior = 'auto';

    var msgsRect = msgsEl.getBoundingClientRect();
    var tRect = node.getBoundingClientRect();
    var delta = tRect.top - msgsRect.top;
    msgsEl.scrollTop = msgsEl.scrollTop + delta - 8;

    msgsEl.style.scrollBehavior = oldBehavior;

    // 立即高亮当前项（不依赖滚动事件回调）
    navTicks.forEach(function (t, k) {
      t.classList.toggle('active', k === i);
    });
    var panelInner = document.getElementById('aiProgressPanelInner');
    if (panelInner) {
      panelInner.querySelectorAll('.ai-progress-item').forEach(function (it, k) {
        it.classList.toggle('active', k === i);
      });
    }
  }

  function initNavEvents() {
    var progress = document.getElementById('aiProgress');
    var panelEl = document.getElementById('aiProgressPanel');
    if (!progress || !panelEl) return;

    progress.addEventListener('mouseenter', function () {
      panelEl.classList.add('show');
    });
    progress.addEventListener('mouseleave', function () {
      panelEl.classList.remove('show');
    });

    var navTimer = null;
    msgsEl.addEventListener('scroll', function () {
      if (navTimer) clearTimeout(navTimer);
      navTimer = setTimeout(function () {
        navUpdateActive();
      }, 80);
    });
  }

  /* ===================== 渲染历史 ===================== */
  function renderHistory() {
    msgsEl.innerHTML = '';
    if (!history.length) {
      var tip = document.createElement('div');
      tip.className = 'ai-msg sys'; tip.textContent = '有什么想问的？';
      msgsEl.appendChild(tip);
      buildNav();
      return;
    }
    history.forEach(function (m, i) {
      var div = document.createElement('div');
      div.className = 'ai-msg ' + (m.role === 'user' ? 'user' : 'ai');
      if (m.role === 'user') {
        div.textContent = m.content;
        div.dataset.q = '1';
      } else {
        div.innerHTML = renderMD(m.content);
      }
      attachMsgActions(div, m.content, m.role, i);
      msgsEl.appendChild(div);
    });
    scrollToBottom();
    buildNav();
  }

  function showToast(msg) {
    var t = document.getElementById('aiToast');
    if (!t) {
      t = document.createElement('div'); t.id = 'aiToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:100px;transform:translateX(-50%) translateY(12px);background:#45b98c;color:#fff;font-size:13px;font-weight:600;padding:10px 22px;border-radius:30px;z-index:2000;box-shadow:0 10px 26px rgba(69,185,140,.34);opacity:0;pointer-events:none;transition:.25s;white-space:nowrap;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(function () { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(12px)'; }, 1800);
  }

  /* ===================== 发送 ===================== */
  function send() {
    if (isStreaming) { stopStream(); return; }
    var text = inputEl.value.trim();
    if (!text) return;
    if (!hasValidCfg()) { showConfig(); return; }
    inputEl.value = ''; inputEl.style.height = 'auto';
    var sys = msgsEl.querySelector('.ai-msg.sys'); if (sys) sys.remove();
        history.push({ role: 'user', content: text }); saveHistory();
    stickBottom = true;
    savedScrollTop = null;
    addMsg('user', text, history.length - 1);

    var pageCtx = buildPageContext();
    var systemContent = cfg.system + (pageCtx ? '\n\n===== 当前页面上下文 =====\n' + pageCtx : '');
    var messages = [{ role: 'system', content: systemContent }].concat(history.slice(-20));

    var aiDiv = document.createElement('div');
    aiDiv.className = 'ai-msg ai';
    msgsEl.appendChild(aiDiv);

    var cursor = document.createElement('span');
    cursor.className = 'ai-cursor';
    aiDiv.appendChild(cursor);

    var acc = '';
    isStreaming = true;
    setSendBtn(true);
    controller = new AbortController();

    /* ——— 打字机缓冲（在 send 作用域声明，所有 then/catch 都能访问） ——— */
    var target = '';
    var shown = '';
    var typeTimer = null;
    function tickType() {
      if (shown.length >= target.length) {
        if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
        return;
      }
      var remain = target.length - shown.length;
      var step = remain > 200 ? 6 : remain > 60 ? 3 : 1;
      shown = target.slice(0, shown.length + step);
      aiDiv.innerHTML = renderMD(shown);
      aiDiv.appendChild(cursor);
      scrollToBottom();
    }
    function ensureTyping() {
      if (typeTimer) return;
      typeTimer = setInterval(tickType, 30);
    }
    /* —————————————————————————————————————————————————— */

    var url = cfg.base.replace(/\/+$/, '') + '/chat/completions';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, messages: messages, stream: true, temperature: 0.6 }),
      signal: controller.signal
    })
    .then(function (res) {
      if (!res.ok) {
        return res.text().then(function (txt) {
          var errMsg = 'HTTP ' + res.status;
          try { var j = JSON.parse(txt); errMsg = (j.error && j.error.message) || j.message || txt; } catch (e) { errMsg = txt || errMsg; }
          throw new Error(errMsg);
        });
      }
      if (!res.body) throw new Error('当前浏览器不支持流式响应');
      var reader = res.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buffer = '';

      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buffer += decoder.decode(r.value, { stream: true });
          var lines = buffer.split('\n'); buffer = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line || line.indexOf('data:') !== 0) continue;
            var data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              var json = JSON.parse(data);
              var delta = (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content)
                       || (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content)
                       || '';
              if (delta) {
                acc += delta;
                target += delta;
                ensureTyping();
              }
            } catch (e) {}
          }
          return pump();
        });
      }
      return pump();
    })
    .then(function () {
      if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
      if (shown.length < target.length) {
        shown = target;
        aiDiv.innerHTML = renderMD(shown);
      }
      cursor.remove();
      if (!acc.trim()) {
        aiDiv.className = 'ai-msg err';
        aiDiv.textContent = '未收到回复，请检查 API Key、模型名称或账户余额。';
        return;
      }
      history.push({ role: 'assistant', content: acc }); saveHistory();
      attachMsgActions(aiDiv, acc, 'ai', history.length - 1);
      buildNav();
    })
    .catch(function (err) {
      if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
      cursor.remove();
      if (err.name === 'AbortError') {
        if (acc.trim()) {
          history.push({ role: 'assistant', content: acc }); saveHistory();
          attachMsgActions(aiDiv, acc, 'ai', history.length - 1);
          buildNav();
        } else aiDiv.remove();
        return;
      }
      aiDiv.className = 'ai-msg err';
      aiDiv.innerHTML = '❌ 请求失败：' + escapeHtml(err.message || '未知错误')
        + '<br><br>常见原因：<br>· API Key 错误或余额不足<br>· Base URL 或模型名填错<br>· 网络无法访问该接口<br>· 服务商未开放浏览器直连（需换服务商或走代理）';
    })
    .then(function () {
      isStreaming = false; controller = null; setSendBtn(false); scrollToBottom();
    });
  }

  function stopStream() {
    if (controller) { try { controller.abort(); } catch (e) {} controller = null; }
    isStreaming = false; setSendBtn(false);
  }
  function setSendBtn(streaming) {
    if (streaming) {
      sendBtn.classList.add('stop');
      sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
      sendBtn.title = '停止';
    } else {
      sendBtn.classList.remove('stop');
      sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
      sendBtn.title = '发送';
    }
  }

  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  inputEl.addEventListener('input', function () {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('show')) closePanel();
  });

  initPresetSelect();
  fillConfigForm();
  initNavEvents();
})();
