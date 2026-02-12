import { CursorManager } from '../utils/CursorManager.js';
import { getBlockElement } from '../../../../scripts/editor/nodeElement.js';
import { processMarkdownInLine } from '../../../../scripts/editor/markdown/commands.js';

/**
 * Execute commands (system and markdown)
 */
export class CommandExecutor {
    /**
     * @param {Object} noteAPI
     */
    constructor(noteAPI) {
        this.noteAPI = noteAPI;
    }

    /**
     * Execute system command
     * @param {Object} command
     * @returns {void}
     */
    executeSystemCommand(command) {
        if (this.noteAPI && typeof this.noteAPI[command.action] === 'function') {
            this.noteAPI[command.action]();
        }
    }

    /**
     * Execute markdown command
     * @param {Object} command
     * @param {Object} savedCursorPosition
     * @returns {void}
     */
    executeMarkdownCommand(command, savedCursorPosition) {
        try {
            CursorManager.restore(savedCursorPosition);
            
            const selection = window.getSelection();
            if (!selection || !selection.rangeCount) {
                return;
            }
            
            const range = selection.getRangeAt(0);
            const nodeStart = range.startContainer;
            const editor = window.rich?.editor || document.querySelector('[contenteditable]');
            const blockElement = getBlockElement(nodeStart, editor);
            
            if (!blockElement) {
                return;
            }
            
            const originalText = blockElement.textContent || '';
            blockElement.textContent = `${command.syntax}${originalText ? ' ' + originalText : ''}`;
            
            const textNode = blockElement.firstChild;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                const cursorPos = (command.syntax || '').length;
                const newRange = document.createRange();
                newRange.setStart(textNode, Math.min(cursorPos, textNode.textContent.length));
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                
                processMarkdownInLine(
                    { preventDefault: () => {} },
                    command.syntax,
                    blockElement,
                    selection,
                    blockElement === editor
                );
            }
        } catch (err) {
            console.error('[CommandExecutor] Failed to execute markdown command', err);
            throw err;
        }
    }
}