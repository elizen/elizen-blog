// markdown-image-parser.js
function parseMarkdownImages() {
    const elements = document.querySelectorAll('.datacont');
    
    elements.forEach(element => {
        const content = element.innerHTML;
        const parsedContent = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
        element.innerHTML = parsedContent;
    });
}

document.addEventListener('DOMContentLoaded', parseMarkdownImages);
