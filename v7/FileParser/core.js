/**
 * FileParser v1.0 — 文件解析核心调度器
 * 方案 011 · Phase A：基础文本解析（PDF/TXT/MD/DOCX）
 *
 * 纯 JS，零框架依赖。所有解析器均使用浏览器原生或 CDN 库。
 * 使用方式：
 *   const parser = new FileParser();
 *   const result = await parser.parse(file);
 */
;(function(global){
  'use strict';

  var PARSER_REGISTRY = {};

  /**
   * 注册解析器
   * @param {string} format
   * @param {object} parser  { detect(file):boolean, parse(file, signal?):Promise<Result> }
   */
  function register(format, parser){
    PARSER_REGISTRY[format] = parser;
  }

  /**
   * 根据文件名或 MIME 类型自动检测文件格式
   * @param {File} file
   * @returns {string|null}
   */
  function detectFormat(file){
    var name = file.name.toLowerCase();
    var mime = file.type;

    if(mime === 'text/plain' || name.endsWith('.txt')) return 'txt';
    if(mime === 'text/markdown' || name.endsWith('.md') || name.endsWith('.markdown')) return 'md';
    if(mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if(mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) return 'docx';

    // fallback: 按扩展名检测
    var ext = name.split('.').pop();
    switch(ext){
      case 'txt': return 'txt';
      case 'md':
      case 'markdown': return 'md';
      case 'pdf': return 'pdf';
      case 'docx': return 'docx';
      default: return null;
    }
  }

  /**
   * 统一结果格式
   */
  function makeResult(format, fileName, size, content, text, html, meta, toc){
    return {
      format: format,
      fileName: fileName,
      size: size,
      meta: meta || {},
      content: content || [],
      text: text || '',
      html: html || '',
      toc: toc || []
    };
  }

  /**
   * FileParser 主构造函数
   */
  function FileParser(){
    this.registry = PARSER_REGISTRY;
  }

  /**
   * 解析单个文件
   * @param {File} file
   * @param {AbortSignal} [signal]  — 可选的中止信号
   * @returns {Promise<object>} 统一格式结果
   */
  FileParser.prototype.parse = async function(file, signal){
    if(!file) throw new Error('FileParser.parse() 需要传入 File 对象');

    var format = detectFormat(file);
    if(!format) throw new Error('不支持的文件格式：' + file.name);

    var parser = PARSER_REGISTRY[format];
    if(!parser) throw new Error('解析器未加载：' + format);

    // 如果有中止信号，检查是否已被中止
    if(signal && signal.aborted) throw new DOMException('解析已中止', 'AbortError');

    try {
      var result = await parser.parse(file, signal);
      // 确保完整的结果结构
      if(!result.format) result.format = format;
      if(!result.fileName) result.fileName = file.name;
      if(!result.size) result.size = file.size;
      return result;
    } catch(e){
      if(e.name === 'AbortError') throw e;
      throw new Error('解析失败 (' + format + '): ' + e.message);
    }
  };

  /**
   * 批量解析多个文件
   * @param {File[]} files
   * @param {function} [onProgress]  — (current, total) => void
   * @returns {Promise<object[]>}
   */
  FileParser.prototype.parseAll = async function(files, onProgress){
    var results = [];
    for(var i = 0; i < files.length; i++){
      var r = await this.parse(files[i]);
      results.push(r);
      if(typeof onProgress === 'function') onProgress(i + 1, files.length);
    }
    return results;
  };

  /**
   * 获取已注册的格式列表
   * @returns {string[]}
   */
  FileParser.prototype.getSupportedFormats = function(){
    return Object.keys(PARSER_REGISTRY);
  };

  // ===== 静态方法 =====
  FileParser.register = register;
  FileParser.detectFormat = detectFormat;
  FileParser.makeResult = makeResult;

  // 暴露到全局
  global.FileParser = FileParser;

})(typeof window !== 'undefined' ? window : this);
