// custom-markdown-parser.js
function parseCustomMarkdown() {
    const elements = document.querySelectorAll('.bb-div');
    
    elements.forEach(element => {
        const datetimeElement = element.querySelector('.datatime');
        const contentElement = element.querySelector('.datacont');
        
        if (contentElement) {
            let content = contentElement.innerHTML;
            
            // Parse Markdown image
            content = content.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');
            
            // Parse hashtags
            content = content.replace(/#(\S+)/g, '<span class="tag-span">#$1</span>');
            
            contentElement.innerHTML = content;
        }
    });
}

document.addEventListener('DOMContentLoaded', parseCustomMarkdown);