#!/bin/bash
# 工作台 HTML 安全扫描脚本（macOS 兼容）
# 用法: bash scripts/security-scan.sh <html_file>

FILE="$1"
if [ -z "$FILE" ]; then echo "用法: $0 <html_file>"; exit 1; fi
if [ ! -f "$FILE" ]; then echo "❌ 文件不存在: $FILE"; exit 1; fi

FILESIZE=$(wc -c < "$FILE" | tr -d ' ')
LINES=$(wc -l < "$FILE" | tr -d ' ')
echo "════════════════════════════════════════"
echo "📄 文件: $(basename $FILE)"
echo "📐 大小: $((FILESIZE/1024))KB | 行数: $LINES"
echo "════════════════════════════════════════"

echo ""
echo "═══ 1️⃣ 外部资源域名引用 ═══"
grep -oE 'https?://[^"'"'"' )>]+' "$FILE" | sort -u || echo "  ✅ 无"

echo ""
echo "═══ 2️⃣ 脚本标签 ═══"
echo "  内联 <script>: $(grep -c '<script' "$FILE")"
echo "  外联 <script src=>: $(grep -c '<script[[:space:]]' "$FILE")"

echo ""
echo "═══ 3️⃣ 敏感 API ═══"
found=0
for kw in "eval(" "new Function(" "document.write(" ".innerHTML=" ".outerHTML=" "fetch(" "XMLHttpRequest" "WebSocket(" "location.href=" "location.replace(" "window.open(" "data:text/javascript;base64"; do
  n=$(grep -cF "$kw" "$FILE" 2>/dev/null || true)
  if [ "$n" -gt 0 ] 2>/dev/null; then
    echo "  ⚠️ $kw → ${n}处"
    found=1
  fi
done
[ "$found" = "0" ] && echo "  ✅ 无敏感 API 调用"

echo ""
echo "═══ 4️⃣ 数据存储 ═══"
for kw in "localStorage" "indexedDB" "sessionStorage"; do
  n=$(grep -cF "$kw" "$FILE" 2>/dev/null || true)
  echo "  💾 $kw → ${n}处"
done

echo ""
echo "═══ 5️⃣ 超长行（可能混淆）═══"
longlines=$(awk 'length > 2000 {print NR": 长度="length}' "$FILE" | head -5)
if [ -n "$longlines" ]; then
  echo "$longlines" | while read line; do echo "  ⚠️ $line"; done
else
  echo "  ✅ 无超长行"
fi

echo ""
echo "═══ 6️⃣ 结构概览 ═══"
echo "  <style>: $(grep -c '<style' "$FILE")"
echo "  <link>: $(grep -c '<link' "$FILE")"
echo "  <img>: $(grep -c '<img' "$FILE")"
echo "  <iframe>: $(grep -c '<iframe' "$FILE")"
echo "  <form>: $(grep -c '<form' "$FILE")"
echo "  @font-face: $(grep -c '@font-face' "$FILE")"

echo ""
echo "════════════════════════════════════════"
echo "✅ 扫描完成"
echo "════════════════════════════════════════"
