const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const topMargin = 80;  // 增加顶部边距
const bottomMargin = 60;  // 保持底部边距略小于顶部
const sideMargin = 40;  // 侧边距
const lineHeight = 70;
const fontSize = 42;
const attributionFontSize = 32;
const maxWidth = 720; // 最大宽度减去左右边距

// 预加载字体
const customFont = new FontFace('CustomFont', 'url(/fonts/custom-font.woff2)');

customFont.load().then(function(loadedFont) {
    document.fonts.add(loadedFont);
    generateImage(); // 初始生成图片
}).catch(function(error) {
    console.error('字体加载失败:', error);
    generateImage(); // 即使字体加载失败，也生成图片
});

function generateImage(forDownload = false) {
    const text = document.getElementById('text').value;
    const attribution = document.getElementById('attribution').value;

    ctx.font = `${fontSize}px CustomFont, sans-serif`;
    
    // 计算文本宽度和换行
    const wrappedLines = [];
    text.split('\n').forEach(paragraph => {
        const words = paragraph.split('');
        let line = '';
        words.forEach(word => {
            const testLine = line + word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && line !== '') {
                wrappedLines.push(line);
                line = word;
            } else {
                line = testLine;
            }
        });
        wrappedLines.push(line);
    });

    // 计算文本高度
    const textHeight = wrappedLines.length * lineHeight;
    
    // 计算总高度（上边距 + 文本高度 + 署名高度 + 下边距）
    const totalHeight = topMargin + textHeight + (attribution ? lineHeight + attributionFontSize : 0) + bottomMargin;

    // 计算内容宽度
    const contentWidth = Math.max(...wrappedLines.map(line => ctx.measureText(line).width));
    const canvasWidth = Math.min(Math.max(contentWidth + sideMargin * 2, 400), 800); // 最小400px，最大800px

    // 设置画布尺寸
    canvas.width = forDownload ? canvasWidth : canvas.offsetWidth;
    canvas.height = totalHeight;

    // 填充背景
    ctx.fillStyle = '#fcfbf8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制文本
    ctx.fillStyle = '#2c3e50';
    ctx.font = `${fontSize}px CustomFont, sans-serif`;
    let y = topMargin;
    wrappedLines.forEach((line) => {
        ctx.fillText(line, sideMargin, y);
        y += lineHeight;
    });

    // 绘制署名
    if (attribution) {
        ctx.font = `${attributionFontSize}px CustomFont, sans-serif`;
        ctx.fillText('/' + attribution, sideMargin, canvas.height - bottomMargin);
    }
}

function downloadImage() {
    generateImage(true); // 生成用于下载的图片
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'generated-text-image.png';
    link.href = image;
    link.click();
    generateImage(); // 重新生成预览图片
}

function copyImage() {
    generateImage(true); // 生成用于复制的图片
    canvas.toBlob(function(blob) {
        const item = new ClipboardItem({ "image/png": blob });
        navigator.clipboard.write([item]).then(function() {
            alert("图片已复制到剪贴板");
        }, function(err) {
            console.error("无法复制图片: ", err);
        });
    });
    generateImage(); // 重新生成预览图片
}

// 初始生成一次图片
window.onload = generateImage;