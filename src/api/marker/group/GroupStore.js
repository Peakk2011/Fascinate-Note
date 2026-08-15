import { persist } from '../board/persistence.js';

export class GroupStore {
    constructor(groupManager) {
        this.groupManager = groupManager;
    }
    
    loadGroups() {
        // Handled by board/persistence.js
    }
    
    saveGroups() {
        persist(
            this.groupManager.windows,
            this.groupManager.groups,
            this.groupManager.board.activeGroupId
        );
    }
    
    updateGroup(groupId, updates) {
        const group = this.groupManager.groups.find(g => g.id === groupId);
        if (group) {
            Object.assign(group, updates);
            this.saveGroups();
        }
    }
    
    deleteGroup(groupId) {
        const index = this.groupManager.groups.findIndex(g => g.id === groupId);
        if (index !== -1) {
            this.groupManager.groups.splice(index, 1);
            
            // Remove group from windows
            this.groupManager.windows.forEach(win => {
                if (win.groupId === groupId) {
                    win.groupId = null;
                }
            });
            
            this.saveGroups();
            this.groupManager.board.setActiveGroup(null);
        }
    }
}