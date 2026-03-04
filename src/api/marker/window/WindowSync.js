import { refreshWindowPreview } from '../board/preview.js';
import { getFontSize } from '../sharedNoteStore.js';
// import { PLACEHOLDER_TEXT } from '../board/constants.js';

export class WindowSync {
    constructor(windowManager) {
        this.windowManager = windowManager;
    }
    
    syncWindowElement(data) {
        refreshWindowPreview(data);
        
        let element = this.windowManager.windowMap.get(data.id);
        
        if (!element) {
            element = this.windowManager.factory.createWindowElement(data);
            this.windowManager.windowMap.set(data.id, element);
            this.windowManager.container.appendChild(element);
        } else {
            this.updateElementContent(element, data);
        }
        
        this.updateElementStyles(element, data);
        this.windowManager.factory.updateGroupBadge(element, data.groupId);
        
        return element;
    }
    
    updateElementContent(element, data) {
        const titleEl = element.querySelector('.marker-window-title');
        const contentEl = element.querySelector('.marker-window-content');
        
        if (titleEl && titleEl.value !== data.title) {
            titleEl.value = data.title || 'Untitled';
        }

        const lodTitleEl = element.querySelector('.marker-window-lod-title');
        if (lodTitleEl) {
            lodTitleEl.textContent = data.title || 'Untitled';
        }
        
        if (contentEl) {
            const isEmpty = !data.content || data.content.trim() === '';
            if (isEmpty) {
                contentEl.textContent = '';
                contentEl.classList.add('is-placeholder');
            } else {
                contentEl.textContent = data.content;
                contentEl.classList.remove('is-placeholder');
            }
            contentEl.style.fontSize = `${getFontSize(16)}px`;
        }
    }
    
    updateElementStyles(element, data) {
        element.style.left = `${data.x}px`;
        element.style.top = `${data.y}px`;
        element.style.width = `${data.width}px`;
        element.style.height = `${data.height}px`;
    }
}
