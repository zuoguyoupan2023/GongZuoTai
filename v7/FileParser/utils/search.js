/**
 * 全文搜索工具
 * 提供对 FileParser 解析结果的全文搜索能力
 */
;(function(global){
  'use strict';

  /**
   * 在解析结果中搜索
   * @param {object} result  — FileParser.parse() 的返回值
   * @param {string} query   — 搜索关键字
   * @returns {Array} 匹配结果 [{ type, text, page?, index }]
   */
  function searchInResult(result, query){
    if(!result || !result.content || !query) return [];

    var q = query.toLowerCase();
    var matches = [];

    result.content.forEach(function(item, idx){
      var text = item.text || '';
      if(text.toLowerCase().indexOf(q) !== -1){
        matches.push({
          index: idx,
          type: item.type,
          text: text.length > 100 ? text.substring(0, 100) + '…' : text,
          page: item.page || null,
          level: item.level || null
        });
      }
    });

    // 也在纯文本中搜索（返回行号）
    if(result.text && matches.length === 0){
      var lines = result.text.split('\n');
      lines.forEach(function(line, idx){
        if(line.toLowerCase().indexOf(q) !== -1){
          matches.push({
            index: idx,
            type: 'text_line',
            text: line.trim().length > 100 ? line.trim().substring(0, 100) + '…' : line.trim(),
            line: idx + 1
          });
        }
      });
    }

    return matches;
  }

  /**
   * 高亮文本中的关键词
   * @param {string} text
   * @param {string} query
   * @returns {string} HTML
   */
  function highlight(text, query){
    if(!text || !query) return escapeHtml(text);
    var q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp('(' + q + ')', 'gi');
    return escapeHtml(text).replace(new RegExp(regex.source, 'gi'), '<mark class="fp-highlight">$1</mark>');
  }

  function escapeHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  global.FileParserSearch = {
    search: searchInResult,
    highlight: highlight
  };

})(typeof window !== 'undefined' ? window : this);
