import { createId, randomColor, getGroupById } from '../board/utils.js';
import { persist } from '../board/persistence.js';
import { GroupStore } from './GroupStore.js';
import { GroupUI } from './GroupUI.js';

export class GroupManager {
    constructor({ board, windows, groups, windowManager }) {
        this.board = board;
        this.windows = windows;
        this.groups = groups;
        this.windowManager = windowManager;
        
        this.store = new GroupStore(this);
        this.ui = new GroupUI(this);
    }
    
    applyGroupToSelection(groupId) {
        if (!this.windowManager.selection.hasSelection()) return;
        
        this.windows.forEach(win => {
            if (!this.windowManager.selection.selectedIds.has(win.id)) return;
            
            win.groupId = groupId || null;
            const el = this.windowManager.windowMap.get(win.id);
            if (el) this.windowManager.factory.updateGroupBadge(el, win.groupId);
        });
        
        persist(this.windows, this.groups, this.board.activeGroupId);
    }
    
    addGroup(name) {
        const group = {
            id: createId(),
            name: name.trim().slice(0, 36),
            color: randomColor()
        };
        
        this.groups.push(group);
        this.applyGroupToSelection(group.id);
        this.board.setActiveGroup(group.id);
        persist(this.windows, this.groups, this.board.activeGroupId);
    }
    
    createNewGroup() {
        if (this.board.groupModal) {
            this.board.groupModal.show();
        } else {
            console.warn('[MarkerBoard] groupModal not provided');
        }
    }
    
    updateToolbarGroups() {
        this.ui.updateToolbarGroups();
    }
    
    getGroupById(id) {
        return getGroupById(this.groups, id);
    }
}