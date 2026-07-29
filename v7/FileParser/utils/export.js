/**
 * 导出工具
 * 将 FileParser 解析结果导出为 Markdown 或 JSON
 */
;(function(global){
  'use strict';

  /**
   * 导出为 Markdown
   */
  function toMarkdown(result){
    if(!result) return '';

    var lines = [];

    // 元信息
    lines.push('---');
    lines.push('title: ' + (result.meta && result.meta.title ? result.meta.title : result.fileName));
    lines.push('format: ' + result.format);
    lines.push('source: ' + result.fileName);
    lines.push('size: ' + result.size);
    lines.push('exported: ' + new Date().toISOString().split('T')[0]);
    lines.push('---');
    lines.push('');

    // 内容
    if(result.content){
      result.content.forEach(function(item){
        switch(item.type){
          case 'heading':
            lines.push('#'.repeat(item.level) + ' ' + item.text);
            break;
          case 'paragraph':
            lines.push(item.text);
            break;
          case 'list':
            lines.push((item.ordered ? '1.' : '-') + ' ' + item.text);
            break;
          case 'code':
            lines.push('```' + (item.language || ''));
            lines.push(item.text);
            lines.push('```');
            break;
          case 'blockquote':
            lines.push('> ' + item.text);
            break;
          case 'hr':
            lines.push('---');
            break;
          default:
            lines.push(item.text || '');
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  /**
   * 导出为 JSON
   */
  function toJSON(result){
    return JSON.stringify({
      format: result.format,
      fileName: result.fileName,
      size: result.size,
      meta: result.meta || {},
      content: (result.content || []).map(function(c){
        return { type: c.type, text: c.text, level: c.level, language: c.language, page: c.page };
      }),
      text: result.text || '',
      toc: result.toc || []
    }, null, 2);
  }

  /**
   * 下载文件
   */
  function download(content, fileName, mimeType){
    mimeType = mimeType || 'text/plain';
    var blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  global.FileParserExport = {
    toMarkdown: toMarkdown,
    toJSON: toJSON,
    download: download
  };

})(typeof window !== 'undefined' ? window : this);
