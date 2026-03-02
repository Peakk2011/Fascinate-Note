export class WindowSelection {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.selectedIds = new Set();
        this.activeWindowId = null;
    }
    
    selectWindow(id, { toggle = false } = {}) {
        if (!id) return;
        
        if (toggle) {
            this.selectedIds.has(id) ? this.selectedIds.delete(id) : this.selectedIds.add(id);
        } else {
            this.clearSelection();
            this.selectedIds.add(id);
            this.windowManager.bringToFront(id);
        }
        
        this.windowManager.setActiveWindow(id);
        this.updateSelectionStyles();
    }
    
    clearSelection() {
        this.selectedIds.clear();
        this.updateSelectionStyles();
    }
    
    updateSelectionStyles() {
        this.windowManager.windowMap.forEach((element, id) => {
            element.classList.toggle('is-selected', this.selectedIds.has(id));
        });
    }
    
    hasSelection() {
        return this.selectedIds.size > 0;
    }
    
    getSelectedIds() {
        return new Set(this.selectedIds);
    }
}