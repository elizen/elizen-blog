const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const margin = 40;
const lineHeight = 60;
const fontSize = 36;
const attributionFontSize = 28;
const maxWidth = 720; // 最大宽度减去左右边距

document.fonts.ready.then(function () {
    generateImage();
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
    const totalHeight = margin + textHeight + (attribution ? lineHeight + attributionFontSize : 0) + margin;

    // 计算内容宽度
    const contentWidth = Math.max(...wrappedLines.map(line => ctx.measureText(line).width));
    const canvasWidth = Math.min(Math.max(contentWidth + margin * 2, 400), 800); // 最小400px，最大800px

    // 设置画布尺寸
    canvas.width = forDownload ? canvasWidth : canvas.offsetWidth;
    canvas.height = totalHeight;

    // 填充背景
    ctx.fillStyle = '#fcfbf8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制文本
    ctx.fillStyle = '#2c3e50';
    ctx.font = `${fontSize}px CustomFont, sans-serif`;
    let y = margin;
    wrappedLines.forEach((line) => {
        ctx.fillText(line, margin, y);
        y += lineHeight;
    });

    // 绘制署名
    if (attribution) {
        ctx.font = `${attributionFontSize}px CustomFont, sans-serif`;
        ctx.fillText('/' + attribution, margin, canvas.height - margin);
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