/**
 * .docx 解析器（使用 mammoth.js）
 * 依赖：从 CDN 加载 https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js
 *
 * 使用前需确保 mammoth 已加载到全局。
 * CDN 加载方式（在 HTML 中添加）：
 *   <script src="https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js"></script>
 */
;(function(global){
  'use strict';

  /**
   * 等待 mammoth 可用
   */
  function waitForMammoth(retries){
    retries = retries || 30;
    return new Promise(function(res, rej){
      function check(){
        if(typeof global.mammoth !== 'undefined' && global.mammoth){
          res(global.mammoth);
        } else if(retries-- > 0){
          setTimeout(check, 200);
        } else {
          rej(new Error('mammoth.js 未加载，请确保已在页面中引入 mammoth.browser.min.js'));
        }
      }
      check();
    });
  }

  /**
   * 将文件读取为 ArrayBuffer
   */
  function readAsArrayBuffer(file){
    return new Promise(function(res, rej){
      var reader = new FileReader();
      reader.onload = function(){ res(reader.result); };
      reader.onerror = function(){ rej(new Error('读取文件失败')); };
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 将 mammoth 生成的 HTML 结构化
   */
  function htmlToContent(html){
    var temp = document.createElement('div');
    temp.innerHTML = html;
    var content = [];
    var children = temp.children;
    for(var i = 0; i < children.length; i++){
      var el = children[i];
      var tag = el.tagName.toLowerCase();
      if(tag.match(/^h[1-6]$/)){
        var level = parseInt(tag.charAt(1));
        content.push({ type:'heading', level:level, text:el.textContent });
      } else if(tag === 'p'){
        content.push({ type:'paragraph', text:el.textContent });
      } else if(tag === 'ul' || tag === 'ol'){
        var items = el.querySelectorAll('li');
        for(var j = 0; j < items.length; j++){
          content.push({ type:'list', ordered:tag==='ol', text:items[j].textContent });
        }
      } else if(tag === 'table'){
        content.push({ type:'table', text:el.textContent });
      } else if(tag === 'img'){
        content.push({ type:'image', src:el.src, caption:el.alt || '' });
      }
    }
    return content;
  }

  /**
   * 从 HTML 中提取纯文本
   */
  function extractText(html){
    var temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  /**
   * 解析 DOCX
   */
  async function parse(file, signal){
    var mammothLib = await waitForMammoth();

    if(signal && signal.aborted) throw new DOMException('解析已中止', 'AbortError');

    var buffer = await readAsArrayBuffer(file);
    var arrayBuffer = buffer; // 已经是 ArrayBuffer

    var result = await mammothLib.convertToHtml({ arrayBuffer: arrayBuffer });

    var html = result.value;
    var warnings = result.messages;

    if(signal && signal.aborted) throw new DOMException('解析已中止', 'AbortError');

    var text = extractText(html);
    var content = htmlToContent(html);

    // 提取 TOC（从标题）
    var toc = content.filter(function(c){ return c.type === 'heading'; }).map(function(c){
      return { text: c.text, level: c.level };
    });

    // 提取标题
    var title = file.name;
    if(toc.length > 0){
      title = toc[0].text;
    }

    return {
      format: 'docx',
      fileName: file.name,
      size: file.size,
      meta: {
        title: title,
        paragraphs: content.filter(function(c){ return c.type === 'paragraph'; }).length,
        warnings: warnings
      },
      content: content,
      text: text,
      html: html,
      toc: toc
    };
  }

  // 注册
  if(typeof FileParser !== 'undefined' && FileParser.register){
    FileParser.register('docx', { parse: parse });
  }

})(typeof window !== 'undefined' ? window : this);
