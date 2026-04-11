import { createNote } from '../sharedNoteStore.js';
import { createId, randomColor } from '../board/utils.js';
import { DEFAULT_WINDOW_SIZE } from '../board/constants.js';

export class WindowData {
    constructor(windowManager) {
        this.windowManager = windowManager;
    }
    
    createWindowData({ x, y, width, height, groupId } = {}) {
        const note = createNote({ title: 'New Note' });
        
        if (!note?.id) {
            console.error('[MarkerBoard] Failed to create note — aborting');
            return null;
        }
        
        const data = {
            id: createId(),
            type: 'note',
            title: note.title || 'New Note',
            previewHtml: '',
            content: '',
            x: x ?? 320,
            y: y ?? 240,
            width: width ?? DEFAULT_WINDOW_SIZE.width,
            height: height ?? DEFAULT_WINDOW_SIZE.height,
            color: randomColor(),
            groupId: groupId ?? this.windowManager.board.activeGroupId,
            isCurrent: false,
            noteId: note.id
        };
        
        this.windowManager.windows.push(data);
        return data;
    }

    createCommentData({ x, y, width, height, groupId } = {}) {
        const data = {
            id: createId(),
            type: 'comment',
            title: 'Comment',
            content: '',
            x: x ?? 320,
            y: y ?? 240,
            width: width ?? DEFAULT_WINDOW_SIZE.width,
            height: height ?? 130,
            color: '#FBF3AD',
            groupId: groupId ?? this.windowManager.board.activeGroupId
        };

        this.windowManager.windows.push(data);
        return data;
    }
}