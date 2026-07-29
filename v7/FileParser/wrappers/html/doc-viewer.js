/**
 * DocViewer v2 — 文档渲染器（原生 HTML 组件）
 * 零依赖，配合 FileParser 的统一结果格式使用。
 *
 * v2 改进：
 *   - 多文件标签页（历史不丢失）
 *   - TOC 固定侧边栏（不受右侧内容撑高影响）
 *   - 布局优化
 *
 * 使用方式：
 *   var viewer = new DocViewer('#viewer');
 *   viewer.render(result);       // 添加并显示一个文件
 *   viewer.switchTab(id);        // 切换到历史文件
 *   viewer.closeTab(id);         // 关闭标签页
 *   viewer.search('关键词');
 */
;(function(global){
  'use strict';

  function DocViewer(selector, options){
    options = options || {};
    this.container = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;
    if(!this.container) throw new Error('DocViewer: 容器元素未找到');

    this.options = options;
    this._files = [];       // [{id, label, format, result}]
    this._fileIdCounter = 0;
    this._activeTabId = null;
    this._tocClickLock = {}; // per-tab scroll guard
    this._init();
  }

  DocViewer.prototype._init = function(){
    this.container.innerHTML = this._getDefaultHTML();
    this._tabs    = this.container.querySelector('.fp-viewer-tabs');
    this._tabList = this.container.querySelector('.fp-viewer-tab-list');
    this._title   = this.container.querySelector('.fp-viewer-title');
    this._toolbar = this.container.querySelector('.fp-viewer-toolbar');
    this._searchInput = this.container.querySelector('.fp-viewer-search-input');
    this._searchBtn   = this.container.querySelector('.fp-viewer-search-btn');
    this._exportBtn   = this.container.querySelector('.fp-viewer-export');
    this._body   = this.container.querySelector('.fp-viewer-body');
    this._meta   = this.container.querySelector('.fp-viewer-meta');
    this._toc    = this.container.querySelector('.fp-viewer-toc');
    this._tocList = this.container.querySelector('.fp-viewer-toc-list');
    this._content = this.container.querySelector('.fp-viewer-content');

    var self = this;

    // 搜索
    if(this._searchBtn){
      this._searchBtn.addEventListener('click', function(){
        self.search(self._searchInput.value);
      });
    }
    if(this._searchInput){
      this._searchInput.addEventListener('keydown', function(e){
        if(e.key === 'Enter') self.search(this.value);
      });
    }

    // 导出
    if(this._exportBtn){
      this._exportBtn.addEventListener('click', function(){
        self.exportText();
      });
    }
  };

  DocViewer.prototype._getDefaultHTML = function(){
    return [
      '<div class="fp-viewer-wrapper">',
        /* 标签栏 */
        '<div class="fp-viewer-tabs">',
          '<div class="fp-viewer-tab-list"></div>',
        '</div>',
        /* 头栏（无标签时显示） */
        '<div class="fp-viewer-header">',
          '<div class="fp-viewer-title">📂 文件学习</div>',
          '<div class="fp-viewer-toolbar">',
            '<input type="text" class="fp-viewer-search-input" placeholder="搜索当前文档…" disabled>',
            '<button class="fp-viewer-search-btn" disabled>🔍</button>',
            '<button class="fp-viewer-export" disabled>📥 导出</button>',
          '</div>',
        '</div>',
        /* 主体 */
        '<div class="fp-viewer-body" style="display:none;">',
          /* 左侧 TOC */
          '<div class="fp-viewer-toc">',
            '<div class="fp-viewer-toc-title">📑 目录</div>',
            '<div class="fp-viewer-toc-list"></div>',
          '</div>',
          /* 右侧内容 */
          '<div class="fp-viewer-right">',
            '<div class="fp-viewer-meta"></div>',
            '<div class="fp-viewer-content"><div class="fp-viewer-empty">📂 在上方拖拽或点击选择文件</div></div>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');
  };

  /* ======================== 标签管理 ======================== */

  DocViewer.prototype._nextId = function(){
    return 'fp_' + (++this._fileIdCounter);
  };

  /**
   * 添加 / 切换到文件
   */
  DocViewer.prototype.render = function(result){
    if(!result) return;

    // 如果同名文件已打开，直接切过去
    var existing = this._files.filter(function(f){ return f.result.fileName === result.fileName; });
    if(existing.length > 0){
      this.switchTab(existing[0].id);
      return;
    }

    var id = this._nextId();
    var label = result.meta && result.meta.title
      ? result.meta.title
      : result.fileName;
    if(label.length > 28) label = label.substring(0, 26) + '…';

    var fileEntry = {
      id: id,
      label: escapeHtml(label),
      format: result.format,
      fileName: result.fileName,
      result: result
    };

    this._files.push(fileEntry);
    this._renderTabBar();
    this.switchTab(id);
  };

  DocViewer.prototype.switchTab = function(id){
    var file = this._findFile(id);
    if(!file) return;

    this._activeTabId = id;

    // 更新标签高亮
    this._renderTabBar();

    // 显示主体
    this._body.style.display = 'flex';
    this._searchInput.disabled = false;
    this._searchBtn.disabled = false;
    this._exportBtn.disabled = false;

    // 渲染
    this._renderFile(file.result);
  };

  DocViewer.prototype.closeTab = function(id, e){
    if(e) { e.stopPropagation(); }

    var idx = -1;
    for(var i = 0; i < this._files.length; i++){
      if(this._files[i].id === id){ idx = i; break; }
    }
    if(idx === -1) return;

    this._files.splice(idx, 1);
    this._renderTabBar();

    if(this._files.length === 0){
      this.clear();
    } else {
      var next = Math.min(idx, this._files.length - 1);
      this.switchTab(this._files[next].id);
    }
  };

  DocViewer.prototype._findFile = function(id){
    for(var i = 0; i < this._files.length; i++){
      if(this._files[i].id === id) return this._files[i];
    }
    return null;
  };

  DocViewer.prototype._renderTabBar = function(){
    var self = this;
    this._tabList.innerHTML = this._files.map(function(f){
      var active = f.id === self._activeTabId ? ' active' : '';
      var icon = self._formatIcon(f.format);
      return '<div class="fp-viewer-tab' + active + '" data-id="' + f.id + '">'
        + '<span class="fp-tab-icon">' + icon + '</span>'
        + '<span class="fp-tab-label">' + f.label + '</span>'
        + '<span class="fp-tab-close" data-id="' + f.id + '">✕</span>'
        + '</div>';
    }).join('');

    // 标签点击
    this._tabList.querySelectorAll('.fp-viewer-tab').forEach(function(el){
      el.addEventListener('click', function(e){
        if(e.target.classList.contains('fp-tab-close')) return;
        self.switchTab(this.dataset.id);
      });
    });

    // 关闭按钮
    this._tabList.querySelectorAll('.fp-tab-close').forEach(function(el){
      el.addEventListener('click', function(e){
        self.closeTab(this.dataset.id, e);
      });
    });

    // 如果没有文件，显示空状态
    if(this._files.length === 0){
      this._title.innerHTML = '📂 文件学习';
      this._body.style.display = 'none';
      this._searchInput.disabled = true;
      this._searchBtn.disabled = true;
      this._exportBtn.disabled = true;
    }
  };

  /* ======================== 渲染 ======================== */

  DocViewer.prototype._renderFile = function(result){
    // 标题（工具栏左侧）
    var icon = this._formatIcon(result.format);
    var label = result.meta && result.meta.title
      ? result.meta.title : result.fileName;
    this._title.innerHTML = icon + ' ' + escapeHtml(label);

    // 元信息
    this._renderMeta(result);

    // 目录
    this._renderTOC(result);

    // 内容
    if(result.html){
      this._content.innerHTML = result.html;
    } else if(result.content && result.content.length > 0){
      this._content.innerHTML = this._contentToHTML(result.content);
    } else {
      this._content.innerHTML = '<div class="fp-viewer-empty">无内容可显示</div>';
    }

    this._content.scrollTop = 0;
    this._searchInput.value = '';
  };

  DocViewer.prototype._renderMeta = function(result){
    if(!result || !result.meta) return;
    var parts = [];
    parts.push('<span class="fp-viewer-meta-tag">' + this._formatIcon(result.format) + ' ' + this._formatLabel(result.format) + '</span>');
    parts.push('<span class="fp-viewer-meta-tag">📄 ' + escapeHtml(result.fileName) + '</span>');
    parts.push('<span class="fp-viewer-meta-tag">📏 ' + formatSize(result.size) + '</span>');

    if(result.meta.pages)       parts.push('<span class="fp-viewer-meta-tag">📖 ' + result.meta.pages + ' 页</span>');
    if(result.meta.author)      parts.push('<span class="fp-viewer-meta-tag">✍️ ' + escapeHtml(result.meta.author) + '</span>');
    if(result.meta.lines)       parts.push('<span class="fp-viewer-meta-tag">📃 ' + result.meta.lines + ' 行</span>');
    if(result.meta.headings)    parts.push('<span class="fp-viewer-meta-tag">📑 ' + result.meta.headings + ' 个标题</span>');
    if(result.meta.paragraphs)  parts.push('<span class="fp-viewer-meta-tag">📝 ' + result.meta.paragraphs + ' 段落</span>');

    this._meta.innerHTML = parts.join('');
  };

  DocViewer.prototype._renderTOC = function(result){
    var toc = result.toc || [];
    if(toc.length === 0){
      this._toc.style.display = 'none';
      return;
    }

    this._toc.style.display = 'block';
    var self = this;

    this._tocList.innerHTML = toc.map(function(item, idx){
      var paddingLeft = (item.level - 1) * 16 + 8;
      return '<div class="fp-viewer-toc-item" data-idx="' + idx + '" style="padding-left:' + paddingLeft + 'px">'
        + '<span class="fp-viewer-toc-dot"></span>'
        + escapeHtml(item.text)
        + '</div>';
    }).join('');

    this._tocList.querySelectorAll('.fp-viewer-toc-item').forEach(function(el, i){
      el.addEventListener('click', function(){
        var idx = parseInt(this.dataset.idx);

        var headings = self._content.querySelectorAll('h1, h2, h3, h4, h5, h6');
        var headingCount = 0;
        for(var j = 0; j < toc.length; j++){
          if(j === idx){
            if(headings[headingCount]){
              headings[headingCount].scrollIntoView({ behavior:'smooth', block:'center' });
            }
            break;
          }
          // count headings up to this toc entry
          // toc entries correspond to headings in order
          headingCount++;
        }

        self._tocList.querySelectorAll('.fp-viewer-toc-item').forEach(function(x){ x.classList.remove('active'); });
        el.classList.add('active');
      });
    });
  };

  /**
   * 搜索并高亮
   */
  DocViewer.prototype.search = function(query){
    if(!query || !query.trim()){
      this._clearHighlights();
      return;
    }

    var q = query.trim().toLowerCase();
    var walker = document.createTreeWalker(this._content, 4, null, false);
    var textNodes = [];
    while(walker.nextNode()) textNodes.push(walker.currentNode);

    this._clearHighlights();

    var count = 0;
    textNodes.forEach(function(node){
      var text = node.textContent;
      var lower = text.toLowerCase();
      var idx = lower.indexOf(q);
      if(idx === -1) return;

      var parent = node.parentNode;
      if(parent && parent.tagName === 'MARK') return;

      var fragment = document.createDocumentFragment();
      var lastIdx = 0;

      while(idx !== -1){
        if(idx > lastIdx){
          fragment.appendChild(document.createTextNode(text.substring(lastIdx, idx)));
        }
        var mark = document.createElement('mark');
        mark.className = 'fp-highlight';
        mark.textContent = text.substring(idx, idx + q.length);
        fragment.appendChild(mark);
        lastIdx = idx + q.length;
        idx = lower.indexOf(q, lastIdx);
        count++;
      }
      if(lastIdx < text.length){
        fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
      }
      parent.replaceChild(fragment, node);
    });

    // 搜索结果数
    var existing = this._meta.querySelector('.fp-search-count');
    if(existing) existing.remove();
    if(count > 0){
      var badge = document.createElement('span');
      badge.className = 'fp-viewer-meta-tag fp-search-count';
      badge.textContent = '🔍 找到 ' + count + ' 处';
      this._meta.appendChild(badge);
    }
  };

  DocViewer.prototype._clearHighlights = function(){
    this._content.querySelectorAll('.fp-highlight').forEach(function(mark){
      var parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
    var existing = document.querySelector('.fp-search-count');
    if(existing) existing.remove();
  };

  /**
   * 导出
   */
  DocViewer.prototype.exportText = function(){
    var file = this._findFile(this._activeTabId);
    if(!file) return;
    var result = file.result;
    var text = result.text || this._content.textContent;
    var blob = new Blob([text], { type:'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    var baseName = (result.fileName || '文档').replace(/\.[^.]+$/, '');
    a.download = baseName + '_导出.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /**
   * 清空
   */
  DocViewer.prototype.clear = function(){
    this._files = [];
    this._activeTabId = null;
    this._tabList.innerHTML = '';
    this._title.innerHTML = '📂 文件学习';
    this._body.style.display = 'none';
    this._meta.innerHTML = '';
    this._tocList.innerHTML = '';
    this._toc.style.display = 'none';
    this._content.innerHTML = '<div class="fp-viewer-empty">📂 在上方拖拽或点击选择文件</div>';
    this._searchInput.value = '';
    this._searchInput.disabled = true;
    this._searchBtn.disabled = true;
    this._exportBtn.disabled = true;
  };

  /* ======================== 工具 ======================== */

  DocViewer.prototype._contentToHTML = function(content){
    if(!content || content.length === 0){
      return '<div class="fp-viewer-empty">无内容</div>';
    }
    return content.map(function(item){
      switch(item.type){
        case 'heading':
          return '<h' + item.level + '>' + escapeHtml(item.text) + '</h' + item.level + '>';
        case 'paragraph':
          return '<p>' + escapeHtml(item.text) + '</p>';
        case 'list':
          return '<p class="fp-list-item">' + (item.ordered ? '•' : '·') + ' ' + escapeHtml(item.text) + '</p>';
        case 'code':
          return '<pre><code>' + escapeHtml(item.text) + '</code></pre>';
        case 'blockquote':
          return '<blockquote>' + escapeHtml(item.text) + '</blockquote>';
        case 'image':
          return '<img src="' + escapeHtml(item.src) + '" alt="' + escapeHtml(item.caption || '') + '" style="max-width:100%;border-radius:8px;">';
        case 'hr':
          return '<hr>';
        default:
          return '<p>' + escapeHtml(item.text || '') + '</p>';
      }
    }).join('\n');
  };

  DocViewer.prototype._formatIcon = function(format){
    return ({ pdf:'📕', txt:'📄', md:'📝', docx:'📘' })[format] || '📄';
  };
  DocViewer.prototype._formatLabel = function(format){
    return ({ pdf:'PDF', txt:'TXT', md:'Markdown', docx:'DOCX' })[format] || format.toUpperCase();
  };

  function escapeHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatSize(bytes){
    if(bytes < 1024) return bytes + ' B';
    if(bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/1024/1024).toFixed(1) + ' MB';
  }

  global.DocViewer = DocViewer;

})(typeof window !== 'undefined' ? window : this);
