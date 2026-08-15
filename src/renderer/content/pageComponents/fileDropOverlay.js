const TEXT_EXTENSIONS = new Set([
    'txt', 'md', 'markdown', 'rtf', 'csv', 'tsv',
    'json', 'yaml', 'yml', 'log', 'ini', 'cfg'
]);

const escapeHTML = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/[&<>"']/g, (char) => {
        switch (char) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#039;';
            default: return char;
        }
    });
};

const textToHtml = (text) => {
    const lines = String(text || '').split(/\r?\n/);
    return lines.map((line) => {
        const safe = escapeHTML(line);
        return `<div>${safe || '<br>'}</div>`;
    }).join('');
};

const getFileExtension = (name = '') => {
    const parts = name.toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() : '';
};

const isTextFile = (file) => {
    if (!file) return false;
    if (file.type && file.type.startsWith('text/')) return true;
    const ext = getFileExtension(file.name);
    return TEXT_EXTENSIONS.has(ext);
};

const hasTextFile = (dataTransfer) => {
    if (!dataTransfer) return false;
    const items = Array.from(dataTransfer.items || []);
    for (const item of items) {
        if (item.kind !== 'file') continue;
        const file = item.getAsFile?.();
        if (isTextFile(file)) return true;
    }
    return false;
};

export const createFileDropOverlayMarkup = () => {
    return `
        <div id="file-drop-overlay" class="file-drop-overlay" aria-hidden="true">
            <div class="file-drop-card">Release this file to open the file</div>
        </div>
    `;
};

export const initFileDropOverlay = ({ editor, noteAPI } = {}) => {
    const overlay = document.getElementById('file-drop-overlay');
    if (!overlay || !editor) {
        return { cleanup: () => { } };
    }

    let dragDepth = 0;

    const showOverlay = () => {
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
    };

    const hideOverlay = () => {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
    };

    const handleDragEnter = (e) => {
        if (!hasTextFile(e.dataTransfer)) return;
        dragDepth += 1;
        showOverlay();
        e.preventDefault();
    };

    const handleDragOver = (e) => {
        if (!hasTextFile(e.dataTransfer)) return;
        e.preventDefault();
    };

    const handleDragLeave = (e) => {
        if (!hasTextFile(e.dataTransfer)) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) {
            hideOverlay();
        }
    };

    const handleDrop = async (e) => {
        if (!hasTextFile(e.dataTransfer)) return;
        e.preventDefault();
        dragDepth = 0;
        hideOverlay();

        const files = Array.from(e.dataTransfer.files || []);
        const file = files.find(isTextFile);
        if (!file) return;

        try {
            const text = await file.text();
            editor.innerHTML = textToHtml(text);
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            if (noteAPI?.saveData) {
                await noteAPI.saveData();
            }
        } catch (error) {
            console.error('Failed to open dropped file:', error);
        }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return {
        cleanup() {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('drop', handleDrop);
        }
    };
};
