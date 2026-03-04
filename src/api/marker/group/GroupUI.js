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
     * Updates the custom group menu in the marker controls bar.
     */
    updateToolbarGroups() {
        const controlsRoot = this.board.bottomBar || this.board.toolbar;
        const trigger = controlsRoot?.querySelector('.marker-group-trigger');
        const menu = controlsRoot?.querySelector('.marker-group-menu');
        if (!trigger || !menu) return;

        menu.innerHTML = '';

        const makeOption = (label, value, isActive, deletable = false) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'marker-group-option';
            if (isActive) button.classList.add('is-active');
            button.dataset.groupId = value || '';
            button.innerHTML = `
                <span class="marker-group-option-label">${label}</span>
                ${deletable ? '<span class="marker-group-delete" title="Delete group" aria-label="Delete group">✕</span>' : ''}
            `;
            return button;
        };

        menu.appendChild(
            makeOption('All Notes', '', !this.board.activeGroupId)
        );

        this.groupManager.groups.forEach(group => {
            menu.appendChild(
                makeOption(group.name, group.id, this.board.activeGroupId === group.id, true)
            );
        });

        const active = this.groupManager.groups.find(g => g.id === this.board.activeGroupId);
        trigger.textContent = active?.name || 'All Notes';
    }
    
    /**
     * Renders a group badge for a window.
     * @param {string} groupId - The ID of the group.
     */
    renderGroupBadge(groupId) {
        // Handled by WindowFactory.updateGroupBadge
    }
}
