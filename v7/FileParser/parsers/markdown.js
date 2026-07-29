/**
 * .md / .markdown 解析器
 * 手写渲染器（轻量，零依赖）。
 * 支持：标题/段落/列表/代码块/引用/图片/链接/粗体/斜体/行内代码/分割线
 * 输出统一的 content[]、html、text、toc 结构
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

  /**
   * 解析 Markdown 文本
   */
  function parseMarkdown(md){
    var lines = md.split('\n');
    var content = [];
    var toc = [];
    var htmlParts = [];
    var i = 0;

    while(i < lines.length){
      var line = lines[i];
      var trimmed = line.trim();

      // 空行
      if(!trimmed){
        i++;
        continue;
      }

      // 标题
      var headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if(headingMatch){
        var level = headingMatch[1].length;
        var text = headingMatch[2];
        var plainText = stripInlineMarkdown(text);
        content.push({ type:'heading', level:level, text:line });
        // TOC
        toc.push({ text:plainText, level:level });

        var anchor = 'h' + level + '-' + slugify(plainText);
        htmlParts.push('<h' + level + ' id="' + anchor + '">' + renderInline(text) + '</h' + level + '>');
        i++;
        continue;
      }

      // 代码块 (```)
      if(trimmed.startsWith('```')){
        var lang = trimmed.substring(3).trim();
        var codeLines = [];
        i++;
        while(i < lines.length && !lines[i].trim().startsWith('```')){
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        var codeText = codeLines.join('\n');
        content.push({ type:'code', language:lang || '', text:codeText });
        htmlParts.push('<pre><code' + (lang?' class="language-'+lang+'"':'') + '>' + escapeHtml(codeText) + '</code></pre>');
        continue;
      }

      // 行内代码块 (`code`)
      if(trimmed.startsWith('`') && trimmed.endsWith('`') && !trimmed.includes('```')){
        var inlineCode = trimmed.slice(1, -1);
        content.push({ type:'code', language:'', text:inlineCode });
        htmlParts.push('<pre><code>' + escapeHtml(inlineCode) + '</code></pre>');
        i++;
        continue;
      }

      // 分割线 (--- 或 ***)
      if(/^(-{3,}|\*{3,})$/.test(trimmed)){
        content.push({ type:'hr', text:'---' });
        htmlParts.push('<hr>');
        i++;
        continue;
      }

      // 引用块 (>)
      if(trimmed.startsWith('>')){
        var quoteLines = [];
        while(i < lines.length && lines[i].trim().startsWith('>')){
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        var quoteText = quoteLines.join(' ');
        content.push({ type:'blockquote', text:quoteText });
        htmlParts.push('<blockquote>' + renderInline(quoteText) + '</blockquote>');
        continue;
      }

      // 无序列表 (- 或 *)
      if(/^[-*+]\s/.test(trimmed)){
        var listItems = [];
        var listStart = i;
        while(i < lines.length && /^[-*+]\s/.test(lines[i].trim())){
          listItems.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
          i++;
        }
        listItems.forEach(function(item){
          content.push({ type:'list', ordered:false, text:item });
        });
        htmlParts.push('<ul>' + listItems.map(function(item){
          return '<li>' + renderInline(item) + '</li>';
        }).join('') + '</ul>');
        continue;
      }

      // 有序列表 (1. 2.)
      if(/^\d+\.\s/.test(trimmed)){
        var oItems = [];
        while(i < lines.length && /^\d+\.\s/.test(lines[i].trim())){
          oItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
          i++;
        }
        oItems.forEach(function(item){
          content.push({ type:'list', ordered:true, text:item });
        });
        htmlParts.push('<ol>' + oItems.map(function(item){
          return '<li>' + renderInline(item) + '</li>';
        }).join('') + '</ol>');
        continue;
      }

      // 图片 ![](src)
      var imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if(imgMatch){
        var alt = imgMatch[1];
        var src = imgMatch[2];
        content.push({ type:'image', src:src, caption:alt });
        htmlParts.push('<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" style="max-width:100%;">');
        i++;
        continue;
      }

      // 默认段落（合并连续非空行）
      var paraLines = [];
      while(i < lines.length && lines[i].trim()){
        paraLines.push(lines[i]);
        i++;
      }
      // 跳过尾随空行
      while(i < lines.length && !lines[i].trim()) i++;
      var paraText = paraLines.join(' ').trim();
      if(paraText){
        content.push({ type:'paragraph', text:paraText });
        htmlParts.push('<p>' + renderInline(paraText) + '</p>');
      }
    }

    return { content:content, html:htmlParts.join('\n'), toc:toc };
  }

  // 行内渲染：粗体/斜体/链接/行内代码/图片
  function renderInline(text){
    return text
      // 图片 ![]() （行内）
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;vertical-align:middle;">')
      // 链接 [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      // 粗体 **text**
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 斜体 *text*
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // 行内代码
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 删除线 ~~text~~
      .replace(/~~(.+?)~~/g, '<del>$1</del>');
  }

  function stripInlineMarkdown(text){
    return text
      .replace(/[*_~`]/g, '')
      .replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')
      .trim();
  }

  function escapeHtml(s){
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function slugify(s){
    return s.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-|-$/g, '') || 'heading';
  }

  /**
   * Markdown 解析入口
   */
  function parse(file, signal){
    return readAsText(file).then(function(text){
      var parsed = parseMarkdown(text);
      // 提取纯文本（去掉 Markdown 标记）
      var plainText = parsed.content.map(function(c){
        if(c.type === 'heading' || c.type === 'paragraph' || c.type === 'blockquote' || c.type === 'list'){
          return c.text;
        }
        if(c.type === 'code') return c.text;
        return '';
      }).join('\n');

      // 第一行作为标题
      var firstHeading = parsed.toc.length > 0 ? parsed.toc[0].text : '';
      var title = firstHeading || text.trim().split('\n')[0] || file.name;
      if(title.length > 80) title = title.substring(0, 80) + '…';

      return {
        format: 'md',
        fileName: file.name,
        size: file.size,
        meta: { title: title, headings: parsed.toc.length },
        content: parsed.content,
        text: plainText,
        html: parsed.html,
        toc: parsed.toc
      };
    });
  }

  // 注册
  if(typeof FileParser !== 'undefined' && FileParser.register){
    FileParser.register('md', { parse: parse });
  }

})(typeof window !== 'undefined' ? window : this);
