/* ============================================================
   统一的 HTML 转义工具（8 个子页共用）
   —— 先解码已存在的 HTML 实体，再统一转义，避免出现 &amp;lt; 这种二次转义。

   背景：各页数据里混着裸的 < 和已经写成 &lt; 的实体（同一个句子里都可能两种混用）。
   旧版 esc() 直接就把 & 转成 &amp;，于是 &lt; 变成 &amp;lt;，
   浏览器显示成字面的 "&lt;" 而不是 "<"。
   实测：微观背诵数据里有 12 处、微观简答有 13 处 &lt;/&gt;。

   用法：题目/答案等纯文本一律走 safeText()。
   ============================================================ */
(function () {
  'use strict';

  function decodeEntities(text) {
    return String(text)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeText(text) {
    if (text === null || text === undefined) return '';
    return escapeHtml(decodeEntities(text));
  }

  window.decodeEntities = decodeEntities;
  window.escapeHtml = escapeHtml;
  window.safeText = safeText;
})();
