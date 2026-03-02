/**
 * Manages the UI for marker groups.
 */
export class GroupUI {
    /**
     * Creates an instance of GroupUI.
     * @param {object} groupManager - The group manager instance.
     */
    constructor(groupManager) {
        this.groupManager = groupManager;
        this.board = groupManager.board;
    }
    
    /**
     * Updates the group selection dropdown in the toolbar.
     */
    updateToolbarGroups() {
        const select = this.board.toolbar.querySelector('.marker-group-select');
        if (!select) return;
        
        select.innerHTML = '';
        
        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = 'All Notes';
        select.appendChild(noneOpt);
        
        this.groupManager.groups.forEach(group => {
            const opt = document.createElement('option');
            opt.value = group.id;
            opt.textContent = group.name;
            select.appendChild(opt);
        });
        
        select.value = this.board.activeGroupId || '';
    }
    
    /**
     * Renders a group badge for a window.
     * @param {string} groupId - The ID of the group.
     */
    renderGroupBadge(groupId) {
        // Handled by WindowFactory.updateGroupBadge
    }
}