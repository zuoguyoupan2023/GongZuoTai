#!/usr/bin/env node
/**
 * 🥔 GLM-4V-Flash 识图工具
 *
 * 用法:
 *   node glm-vision.js <图片路径> [提示词]
 *
 * 示例:
 *   node glm-vision.js demo/1325572073.jpg
 *   node glm-vision.js screenshot.png "详细描述这个 UI 的布局、配色、组件"
 *
 * 前置:
 *   在 ~/.zshrc 中设置 export GLM_API_KEY="你的key"
 *   或: GLM_API_KEY="xxx" node glm-vision.js image.jpg
 */

const fs = require('fs');
const path = require('path');

// ===== 配置 =====
const API_KEY = process.env.GLM_API_KEY || '';
const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = 'glm-4v-flash';

// ===== 主逻辑 =====
async function main() {
  // 参数解析
  const args = process.argv.slice(2);
  if (args.length < 1 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
🥔 GLM-4V-Flash 识图工具

用法:
  node glm-vision.js <图片路径> [提示词]

示例:
  node glm-vision.js demo/1325572073.jpg
  node glm-vision.js screenshot.png "详细描述这个界面的布局"

前置:
  export GLM_API_KEY="你的智谱APIKEY"
    `);
    process.exit(0);
  }

  const imagePath = args[0];
  const userPrompt = args.slice(1).join(' ') || '请详细描述这张图片的内容：如果有UI界面，分析其布局结构、配色方案、功能分区、导航方式、组件样式等。如果是教程/截图，请提取其中的关键信息。';

  // 检查 Key
  if (!API_KEY) {
    console.error('❌ 未设置 GLM_API_KEY');
    console.error('   请在 ~/.zshrc 中添加: export GLM_API_KEY="你的智谱APIKEY"');
    console.error('   或临时运行: GLM_API_KEY="xxx" node glm-vision.js image.jpg');
    process.exit(1);
  }

  // 检查图片
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ 图片不存在: ${imagePath}`);
    process.exit(1);
  }

  const ext = path.extname(imagePath).toLowerCase();
  const supported = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
  if (!supported.includes(ext)) {
    console.error(`❌ 不支持的图片格式: ${ext}，支持: ${supported.join(', ')}`);
    process.exit(1);
  }

  // ===== 读取并编码图片 =====
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = ext === '.jpg' ? 'jpeg' : ext.replace('.', '');
  const fileSizeMB = (imageBuffer.length / 1024 / 1024).toFixed(2);

  console.log(`📷 图片: ${path.basename(imagePath)}`);
  console.log(`📐 大小: ${fileSizeMB}MB`);
  console.log(`🔑 API: ${MODEL}`);
  console.log('---');
  console.log('🤔 正在调用 GLM-4V-Flash 识图...\n');

  // ===== 调用 API =====
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: `data:image/${mimeType};base64,${base64Image}` } },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '（无返回内容）';

    // ===== 输出结果 =====
    console.log('✅ GLM-4V-Flash 识图结果:\n');
    console.log(content);
    console.log('\n---');

    // 统计 token 使用
    if (data.usage) {
      console.log(`📊 Token: 输入 ${data.usage.prompt_tokens || '-'} | 输出 ${data.usage.completion_tokens || '-'} | 总计 ${data.usage.total_tokens || '-'}`);
    }

  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      console.error('❌ 请求超时（60秒），图片可能过大，请尝试压缩后重试');
    } else {
      console.error(`❌ 调用失败: ${err.message}`);
    }
    process.exit(1);
  }
}

main();
