/**
 * FileDropzone — 拖拽上传区域（原生 HTML 组件）
 * 零依赖，配合 FileParser 使用。
 *
 * 使用方式：
 *   var dropzone = new FileDropzone('#dropzone', {
 *     accept: ['.pdf', '.md', '.txt', '.docx'],
 *     multiple: true,
 *     onFile: async function(file){ ... },
 *     onFiles: async function(files){ ... }
 *   });
 */
;(function(global){
  'use strict';

  var DEFAULT_ACCEPT = ['.pdf', '.txt', '.md', '.docx'];
  var FORMAT_LABELS = {
    pdf: 'PDF 文档',
    txt: '纯文本',
    md: 'Markdown',
    docx: 'Word 文档'
  };

  function FileDropzone(selector, options){
    options = options || {};
    this.container = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;
    if(!this.container) throw new Error('FileDropzone: 容器元素未找到');

    this.accept = options.accept || DEFAULT_ACCEPT;
    this.multiple = options.multiple !== false;
    this.onFile = options.onFile || null;
    this.onFiles = options.onFiles || null;
    this.maxSize = options.maxSize || 50 * 1024 * 1024; // 默认 50MB

    this._dragCounter = 0;
    this._init();
  }

  FileDropzone.prototype._init = function(){
    var self = this;
    var container = this.container;

    // 添加默认 HTML 结构
    container.innerHTML = this._getDefaultHTML();

    this._dropArea = container.querySelector('.fp-dropzone-area');
    this._input = container.querySelector('.fp-dropzone-input');
    this._status = container.querySelector('.fp-dropzone-status');

    // 点击上传
    this._dropArea.addEventListener('click', function(e){
      if(e.target.closest('.fp-dropzone-btn')) return;
      self._input.click();
    });

    // 按钮点击
    var btn = container.querySelector('.fp-dropzone-btn');
    if(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        self._input.click();
      });
    }

    // 文件选择
    this._input.addEventListener('change', function(e){
      var files = e.target.files;
      if(files.length > 0){
        self._handleFiles(files);
      }
      // 重置以便再次选择相同文件
      this.value = '';
    });

    // 拖拽事件
    this._dropArea.addEventListener('dragenter', function(e){
      e.preventDefault();
      e.stopPropagation();
      self._dragCounter++;
      if(self._dragCounter === 1){
        self._dropArea.classList.add('fp-dropzone-dragover');
      }
    });

    this._dropArea.addEventListener('dragover', function(e){
      e.preventDefault();
      e.stopPropagation();
    });

    this._dropArea.addEventListener('dragleave', function(e){
      e.preventDefault();
      e.stopPropagation();
      self._dragCounter--;
      if(self._dragCounter === 0){
        self._dropArea.classList.remove('fp-dropzone-dragover');
      }
    });

    this._dropArea.addEventListener('drop', function(e){
      e.preventDefault();
      e.stopPropagation();
      self._dragCounter = 0;
      self._dropArea.classList.remove('fp-dropzone-dragover');
      var files = e.dataTransfer.files;
      if(files.length > 0){
        self._handleFiles(files);
      }
    });

    // 粘贴上传
    document.addEventListener('paste', function(e){
      // 仅当 FileParser 页面可见时处理
      var page = document.getElementById('page-fileparser');
      if(!page || !page.classList.contains('active')) return;
      var items = e.clipboardData && e.clipboardData.items;
      if(!items) return;
      for(var i = 0; i < items.length; i++){
        if(items[i].kind === 'file'){
          self._handleFile(items[i].getAsFile());
        }
      }
    });
  };

  FileDropzone.prototype._getDefaultHTML = function(){
    var acceptStr = this.accept.join(',');
    var acceptLabels = this.accept.map(function(ext){
      var label = FORMAT_LABELS[ext.replace('.', '')] || ext;
      return label;
    }).join('、');

    return [
      '<div class="fp-dropzone-area">',
        '<input type="file" class="fp-dropzone-input" accept="' + acceptStr + '" ' +
          (this.multiple ? 'multiple' : '') + ' style="display:none;">',
        '<div class="fp-dropzone-icon">📂</div>',
        '<div class="fp-dropzone-text">',
          '<strong>拖拽文件到此处</strong> 或 <span class="fp-dropzone-btn">点击选择</span>',
        '</div>',
        '<div class="fp-dropzone-hint">支持格式：' + acceptLabels + '</div>',
        '<div class="fp-dropzone-status"></div>',
      '</div>'
    ].join('');
  };

  FileDropzone.prototype._handleFiles = function(fileList){
    var self = this;
    var files = [];
    var errors = [];

    for(var i = 0; i < fileList.length; i++){
      var file = fileList[i];
      var valid = true;

      // 检查格式
      var ext = '.' + file.name.split('.').pop().toLowerCase();
      if(this.accept.length > 0 && !this.accept.includes(ext)){
        errors.push(file.name + '（不支持的文件格式）');
        valid = false;
      }

      // 检查大小
      if(file.size > this.maxSize){
        errors.push(file.name + '（文件过大，最大' + Math.round(this.maxSize/1024/1024) + 'MB）');
        valid = false;
      }

      if(valid) files.push(file);
    }

    if(errors.length > 0){
      this._setStatus('⚠️ ' + errors.join('；'), 'error');
    }

    if(files.length === 0) return;

    // 触发回调
    if(this.onFiles){
      this.onFiles(files);
    } else if(this.onFile){
      files.forEach(function(f){ self.onFile(f); });
    }

    this._setStatus('✅ 已选择 ' + files.length + ' 个文件', 'success');
  };

  FileDropzone.prototype._handleFile = function(file){
    if(!file) return;
    var ext = '.' + file.name.split('.').pop().toLowerCase();
    if(this.accept.length > 0 && !this.accept.includes(ext)) return;
    if(file.size > this.maxSize) return;

    if(this.onFile) this.onFile(file);
    this._setStatus('✅ 已粘贴文件：' + file.name, 'success');
  };

  FileDropzone.prototype._setStatus = function(msg, type){
    if(this._status){
      this._status.textContent = msg;
      this._status.className = 'fp-dropzone-status';
      if(type) this._status.classList.add('fp-dropzone-status-' + type);
    }
  };

  FileDropzone.prototype.clearStatus = function(){
    if(this._status){
      this._status.textContent = '';
      this._status.className = 'fp-dropzone-status';
    }
  };

  FileDropzone.prototype.enable = function(){
    this._input.disabled = false;
    this._dropArea.style.opacity = '1';
    this._dropArea.style.pointerEvents = 'auto';
  };

  FileDropzone.prototype.disable = function(){
    this._input.disabled = true;
    this._dropArea.style.opacity = '0.5';
    this._dropArea.style.pointerEvents = 'none';
  };

  global.FileDropzone = FileDropzone;

})(typeof window !== 'undefined' ? window : this);
