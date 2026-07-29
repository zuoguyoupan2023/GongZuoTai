/**
 * .pdf 解析器（使用 pdf.js）
 * 依赖：从 CDN 加载 https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
 *
 * 使用前需确保 pdfjsLib 已加载到全局。
 * CDN 加载方式（在 HTML 中添加）：
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
 *   <script>pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';</script>
 */
;(function(global){
  'use strict';

  /**
   * 等待 pdfjsLib 可用
   */
  function waitForPdfjs(retries){
    retries = retries || 30;
    return new Promise(function(res, rej){
      function check(){
        if(typeof global.pdfjsLib !== 'undefined' && global.pdfjsLib){
          res(global.pdfjsLib);
        } else if(retries-- > 0){
          setTimeout(check, 200);
        } else {
          rej(new Error('pdf.js 未加载，请确保已在页面中引入 pdf.min.js'));
        }
      }
      check();
    });
  }

  /**
   * 将 PDF 文件读取为 ArrayBuffer
   */
  function readAsArrayBuffer(file){
    return new Promise(function(res, rej){
      var reader = new FileReader();
      reader.onload = function(){ res(reader.result); };
      reader.onerror = function(){ rej(new Error('读取 PDF 文件失败')); };
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 解析 PDF 文件
   */
  async function parse(file, signal){
    var pdfjs = await waitForPdfjs();

    // 设置 worker（如果尚未设置）
    if(!pdfjs.GlobalWorkerOptions.workerSrc){
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    var buffer = await readAsArrayBuffer(file);

    // 检查中止
    if(signal && signal.aborted) throw new DOMException('解析已中止', 'AbortError');

    var pdfDoc = await pdfjs.getDocument({ data: buffer }).promise;
    var totalPages = pdfDoc.numPages;

    // 读取 metadata
    var meta = {};
    try {
      var info = await pdfDoc.getMetadata();
      if(info.info){
        meta.title = info.info.Title || file.name;
        meta.author = info.info.Author || '';
        meta.subject = info.info.Subject || '';
      }
    } catch(e){ /* metadata 非必须 */ }

    var content = [];
    var textChunks = [];
    var htmlParts = [];
    var toc = [];

    // 逐页解析
    for(var p = 1; p <= totalPages; p++){
      if(signal && signal.aborted) throw new DOMException('解析已中止', 'AbortError');

      var page = await pdfDoc.getPage(p);
      var textContent = await page.getTextContent();

      // 提取该页的文本
      var pageText = textContent.items.map(function(item){
        return item.str;
      }).join(' ');

      textChunks.push(pageText);

      // 提取 content item
      content.push({
        type: 'paragraph',
        text: pageText,
        page: p
      });

      // HTML
      htmlParts.push(
        '<div class="pdf-page" data-page="' + p + '">' +
          '<div class="pdf-page-header">第 ' + p + ' / ' + totalPages + ' 页</div>' +
          '<p>' + escapeHtml(pageText) + '</p>' +
        '</div>'
      );

      // 尝试从第一页提取标题（基于字号最大的文本）
      if(p === 1 && pageText.trim()){
        var lines = pageText.split('\n').filter(function(l){ return l.trim(); });
        if(lines.length > 0 && !meta.title){
          meta.title = lines[0].trim();
          if(meta.title.length > 80) meta.title = meta.title.substring(0, 80) + '…';
        }
      }
    }

    meta.pages = totalPages;
    if(!meta.title) meta.title = file.name;

    var fullText = textChunks.join('\n\n');

    return {
      format: 'pdf',
      fileName: file.name,
      size: file.size,
      meta: meta,
      content: content,
      text: fullText,
      html: '<div class="pdf-viewer">' + htmlParts.join('\n') + '</div>',
      toc: toc
    };
  }

  function escapeHtml(s){
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // 注册
  if(typeof FileParser !== 'undefined' && FileParser.register){
    FileParser.register('pdf', { parse: parse });
  }

})(typeof window !== 'undefined' ? window : this);
