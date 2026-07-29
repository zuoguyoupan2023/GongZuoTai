/**
 * .txt 文本解析器
 * 零依赖，用 FileReader.readAsText() 读取
 */
;(function(global){
  'use strict';

  function readAsText(file){
    return new Promise(function(res, rej){
      var reader = new FileReader();
      reader.onload = function(){ res(reader.result); };
      reader.onerror = function(){ rej(new Error('读取文件失败')); };
      reader.readAsText(file, 'UTF-8');
    });
  }

  function textToContent(text){
    var lines = text.split('\n');
    var content = [];
    for(var i = 0; i < lines.length; i++){
      var line = lines[i];
      var trimmed = line.trim();
      if(!trimmed){
        content.push({ type: 'paragraph', text: '' });
        continue;
      }
      content.push({ type: 'paragraph', text: line });
    }
    return content;
  }

  function parse(file, signal){
    return readAsText(file).then(function(text){
      var content = textToContent(text);
      // 简单提取前 100 字符作为"title"
      var title = text.trim().split('\n')[0] || file.name;
      if(title.length > 80) title = title.substring(0, 80) + '…';

      return {
        format: 'txt',
        fileName: file.name,
        size: file.size,
        meta: { title: title, lines: content.length },
        content: content,
        text: text,
        html: '<pre style="white-space:pre-wrap;font-family:inherit;line-height:1.8;">' + escapeHtml(text) + '</pre>',
        toc: []
      };
    });
  }

  function escapeHtml(s){
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // 注册
  if(typeof FileParser !== 'undefined' && FileParser.register){
    FileParser.register('txt', { parse: parse });
  }

})(typeof window !== 'undefined' ? window : this);
