import { Mint } from '../../../../framework/mint.js';
import { fetchJSON } from '../../../../utils/fetch.js';
import { getBlockElement, getTextBeforeCursor } from '../../../scripts/editor/nodeElement.js';
import { processMarkdownInLine } from '../../../scripts/editor/markdown/commands.js';

/**
 * @typedef {Object} CommandConfig
 * @property {string} modalId
 * @property {string} contentClass
 * @property {string} headerClass
 * @property {string} inputClass
 * @property {string} resultsClass
 * @property {string} itemClass
 */

/**
 * @typedef {Object} SystemCommand
 * @property {string} id
 * @property {string} label
 * @property {string} [action] - name of method on `noteAPI` to call
 * @property {string} [description]
 */

/**
 * @typedef {Object} MarkdownCommand
 * @property {string} id
 * @property {string} label
 * @property {string} syntax
 * @property {string} [description]
 * @property {string} [example]
 */

/**
 * @typedef {Object} SavedCursor
 * @property {Node} startContainer
 * @property {number} startOffset
 * @property {boolean} collapsed
 */

/**
 * @typedef {Object} NoteAPI
 * @property {Function} [saveData]
 * @property {Function} [loadData]
 * @property {Function} [zoomIn]
 * @property {Function} [zoomOut]
 * @property {Function} [resetZoom]
 */

Mint.include('stylesheet/style-components/command-palette.css');

/**
 * Create a command palette component factory.
 * @returns {Promise<{
 *   markups: string,
 *   init: function({noteAPI: NoteAPI}): {
 *     show: function(string=): void,
 *     hide: function(): void,
 *     toggle: function(string=): void,
 *     showMarkdownCommands: function(): void,
 *     destroy: function(): void
 *   }
 * }>}
 */
export const createCommandPalette = async () => {
    let config;

    try {
        config = await fetchJSON(
            'renderer/content/contentComponents/commandPalette/commandPaletteConfig.json'
        );
    } catch (error) {
        console.error('[CommandPalette] Failed to load configuration:', error);
        throw new Error('Command Palette configuration could not be loaded');
    }

    // Load commands from external JSON
    let systemCommands = [];
    let markdownCommands = [];

    try {
        const commands = await fetchJSON(
            'renderer/content/contentComponents/commandPalette/commands.json'
        );

        systemCommands = commands.systemCommands || [];
        markdownCommands = commands.markdownCommands || [];
    } catch (error) {
        console.warn(
            '[CommandPalette] failed to load commands.json',
            error
        );
    }

    return {
        markups: `
            <div id="${config.modalId}" class="command-palette-modal" role="dialog" aria-modal="true">
                <div class="${config.contentClass}">
                    <div class="${config.headerClass}">
                        <input type="text" id="command-palette-input" class="${config.inputClass}" placeholder="Type a command or /...">
                        <div class="command-palette-mode"></div>
                    </div>
                    <div id="command-palette-results" class="${config.resultsClass}"></div>
                </div>
            </div>
        `,
        /**
         * Initialize the command palette DOM and wire up behavior.
         * @param {{noteAPI: NoteAPI}} opts
         * @returns {{show: function(string=):void, hide: function():void, toggle: function(string=):void, showMarkdownCommands:function():void, destroy:function():void}}
         */
        init({ noteAPI }) {
            const modal = document.getElementById(config.modalId);
            const content = modal.querySelector(`.${config.contentClass}`);
            const input = document.getElementById('command-palette-input');
            const results = document.getElementById('command-palette-results');
            const modeIndicator = modal.querySelector('.command-palette-mode');

            let isVisible = false;
            let isAnimating = false;
            let currentMode = 'system'; // 'system' or 'markdown'
            let savedCursorPosition = null;
            let activeIndex = -1;

            const getItems = () => Array.from(
                results.querySelectorAll(`.${config.itemClass}`)
            );

            const clearActive = () => {
                getItems().forEach(i => i.classList.remove('active'));
                activeIndex = -1;
            };

            const setActive = (index) => {
                const items = getItems();
                if (!items.length) return;
                // wrap
                if (index < 0) index = items.length - 1;
                if (index >= items.length) index = 0;
                clearActive();
                const el = items[index];
                if (el) {
                    el.classList.add('active');
                    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
                    activeIndex = index;
                }
            };

            /**
             * Capture a shallow snapshot of the current selection so the app can
             * attempt to restore the caret position after opening/closing the palette.
             * This intentionally captures the `startContainer` Node and `startOffset`.
             * It is not a robust position object and restoration will attempt fallbacks
             * when the original node is detached.
             * @returns {SavedCursor|null}
             */
            const saveCursorPosition = () => {
                try {
                    const sel = window.getSelection();
                    if (!sel || !sel.rangeCount) return null;
                    const range = sel.getRangeAt(0).cloneRange();
                    return {
                        startContainer: range.startContainer,
                        startOffset: range.startOffset,
                        collapsed: range.collapsed
                    };
                } catch (err) {
                    console.warn('[CommandPalette] saveCursorPosition failed', err);
                    return null;
                }
            };

            /**
             * Try to restore the selection previously captured by `saveCursorPosition`.
             * If the original node is no longer connected to the document this will
             * fall back to placing the caret at the end of the editor.
             * @param {SavedCursor|null} [saved]
             * @returns {void}
             */
            const restoreCursorPosition = (saved = savedCursorPosition) => {
                try {
                    const editor = window.rich?.editor || document.querySelector('[contenteditable]');
                    if (!saved || !editor) return;

                    const { startContainer, startOffset } = saved;
                    let node = startContainer;

                    if (!node || (node.nodeType && node.nodeType === Node.ELEMENT_NODE && !node.isConnected) || (node.nodeType === Node.TEXT_NODE && !node.parentNode)) {
                        // fallback: place caret at end of editor
                        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
                        let lastText = null;
                        while (walker.nextNode()) lastText = walker.currentNode;
                        const range = document.createRange();
                        if (lastText) {
                            range.setStart(lastText, lastText.textContent.length);
                        } else {
                            range.selectNodeContents(editor);
                            range.collapse(false);
                        }
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                        return;
                    }

                    // Clamp offsets for text nodes
                    const range = document.createRange();
                    if (node.nodeType === Node.TEXT_NODE) {
                        const off = Math.min(startOffset, node.textContent.length);
                        range.setStart(node, off);
                    } else {
                        // element node: find child at offset or clamp
                        const childIndex = Math.min(startOffset, node.childNodes.length);
                        range.setStart(node.childNodes[childIndex] || node, 0);
                    }
                    range.collapse(true);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                } catch (err) {
                    console.warn('[CommandPalette] restoreCursorPosition failed', err);
                }
            };

            /**
             * Render the given command list into the results container and animate
             * the height change. The function measures previous and next heights,
             * applies a short transition and replaces the content with a
             * document-fragment-based render.
             * @param {Array<SystemCommand|MarkdownCommand>} [filteredCommands]
             * @param {boolean} [isMarkdownMode=false]
             * @returns {void}
             */
            const renderResults = (filteredCommands = [], isMarkdownMode = false) => {
                // measure previous height
                const prevHeight = results.getBoundingClientRect().height || 0;

                // build fragment
                const frag = document.createDocumentFragment();
                if (!filteredCommands || filteredCommands.length === 0) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'command-empty';
                    emptyDiv.textContent = 'No commands found';
                    frag.appendChild(emptyDiv);
                } else {
                    filteredCommands.forEach((command, idx) => {
                        const div = document.createElement('div');
                        div.classList.add(config.itemClass);
                        div.dataset.index = String(idx);

                        if (isMarkdownMode) {
                            div.innerHTML = `
                                <div class="command-item-main">
                                    <span class="command-syntax">${command.syntax}</span>
                                    <span class="command-description">${command.description}</span>
                                </div>
                            `;
                            div.addEventListener('click', () => {
                                try {
                                    restoreCursorPosition();
                                    const selection = window.getSelection();
                                    if (!selection || !selection.rangeCount) { hide(); return; }
                                    const range = selection.getRangeAt(0);
                                    const nodeStart = range.startContainer;
                                    const editor = window.rich?.editor || document.querySelector('[contenteditable]');
                                    const blockElement = getBlockElement(nodeStart, editor);
                                    if (!blockElement) { hide(); return; }
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
                                        processMarkdownInLine({ preventDefault: () => {} }, command.syntax, blockElement, selection, blockElement === editor);
                                    }
                                } catch (err) { console.error('[CommandPalette] apply markdown', err); }
                                finally { hide(); }
                            });
                            div.addEventListener('mouseover', () => setActive(idx));
                        } else {
                            div.innerHTML = `
                                <div class="command-item-main">
                                    <span class="command-label">${command.label}</span>
                                    ${command.description ? `<span class="command-description">${command.description}</span>` : ''}
                                </div>
                            `;
                            div.addEventListener('click', () => { if (noteAPI && typeof noteAPI[command.action] === 'function') noteAPI[command.action](); hide(); });
                            div.addEventListener('mouseover', () => setActive(idx));
                        }

                        frag.appendChild(div);
                    });
                }

                // measure new height using hidden temp
                const temp = document.createElement('div');
                temp.style.position = 'absolute';
                temp.style.visibility = 'hidden';
                temp.style.pointerEvents = 'none';
                temp.style.width = results.clientWidth + 'px';
                temp.appendChild(frag.cloneNode(true));
                results.parentElement.appendChild(temp);
                const newScrollHeight = Math.min(temp.scrollHeight, 400);
                temp.parentElement.removeChild(temp);

                // animate
                results.style.height = prevHeight + 'px';
                results.style.overflow = 'hidden';

                // * height animation transition
                results.style.transition = 'height 200ms var(--transition)';

                // replace content
                results.innerHTML = '';
                results.appendChild(frag);

                requestAnimationFrame(() => {
                    results.style.height = newScrollHeight + 'px';
                });

                const onEnd = () => {
                    results.style.transition = '';
                    results.style.height = '';
                    results.style.overflow = newScrollHeight >= 400 ? 'auto' : 'hidden';
                    results.removeEventListener('transitionend', onEnd);
                };

                results.addEventListener('transitionend', onEnd);

                // reset active
                clearActive();
            };

            /**
             * Handle input changes in the palette search box and switch between
             * system and markdown command modes depending on the typed value.
             * @returns {void}
             */
            const handleInput = () => {
                const value = input.value.toLowerCase();

                if (value.startsWith('/') || value.startsWith('#') || value === '-' || /^\d+\.$/.test(value)) {
                    if (currentMode !== 'markdown') {
                        currentMode = 'markdown';
                        modeIndicator.textContent = 'Markdown Commands';
                        modeIndicator.style.display = 'block';
                    }

                    const filteredCommands = markdownCommands.filter(c =>
                        c.syntax.toLowerCase().includes(value) ||
                        c.description.toLowerCase().includes(value)
                    );
                    renderResults(filteredCommands, true);
                } else {
                    if (currentMode !== 'system') {
                        currentMode = 'system';
                        modeIndicator.style.display = 'none';
                    }

                    const filteredCommands = systemCommands.filter(c =>
                        c.label.toLowerCase().includes(value)
                    );
                    renderResults(filteredCommands, false);
                }
            };

            /**
             * Show the palette. Saves cursor, switches mode, renders initial results
             * and starts the opening animation. The returned `savedCursorPosition`
             * is used to restore focus when the palette is closed.
             * @param {'system'|'markdown'} [mode='system']
             * @returns {void}
             */
            const show = (mode = 'system') => {
                if (isVisible || isAnimating) return;

                isAnimating = true;
                currentMode = mode;

                savedCursorPosition = saveCursorPosition();

                modal.style.display = 'flex';
                input.value = '';

                if (mode === 'markdown') {
                    modeIndicator.textContent = 'Markdown Commands';
                    modeIndicator.style.display = 'block';
                    renderResults(markdownCommands, true);
                } else {
                    modeIndicator.style.display = 'none';
                    renderResults(systemCommands, false);
                }

                requestAnimationFrame(() => {
                    modal.classList.add('visible');
                    content.classList.remove('closing');
                    content.classList.add('opening');
                    isVisible = true;

                    setTimeout(() => {
                        input.focus();
                        isAnimating = false;
                    }, 250);
                });
            };

            /**
             * Hide the palette and restore editor focus + saved cursor position.
             * @returns {void}
             */
            const hide = () => {
                if (!isVisible || isAnimating) return;

                isAnimating = true;
                content.classList.remove('opening');
                content.classList.add('closing');

                setTimeout(() => {
                    modal.classList.remove('visible');
                    modal.style.display = 'none';
                    content.classList.remove('closing');
                    isVisible = false;
                    isAnimating = false;
                    input.value = '';
                    results.innerHTML = '';
                    modeIndicator.style.display = 'none';
                    currentMode = 'system';

                    const editor = window.rich?.editor || document.querySelector('[contenteditable]');
                    if (editor) {
                        editor.focus();
                        restoreCursorPosition();
                    }
                }, 200);
            };

            /**
             * Toggle palette visibility. If visible and `mode` differs it will
             * switch the internal mode without closing/reopening (keeps animation smooth).
             * @param {'system'|'markdown'} [mode='system']
             * @returns {void}
             */
            const toggle = (mode = 'system') => {
                if (isAnimating) return;

                if (!isVisible) {
                    show(mode);
                    return;
                }

                if (isVisible && mode === currentMode) {
                    hide();
                    return;
                }

                if (isVisible && mode !== currentMode) {
                    currentMode = mode;
                    input.value = '';

                    if (mode === 'markdown') {
                        modeIndicator.textContent = 'Markdown Commands';
                        modeIndicator.style.display = 'block';
                        renderResults(markdownCommands, true);
                    } else {
                        modeIndicator.style.display = 'none';
                        renderResults(systemCommands, false);
                    }

                    setTimeout(() => input.focus(), 0);
                }
            };

            /**
             * Convenience: open palette in markdown mode.
             * @returns {void}
             */
            const showMarkdownCommands = () => {
                show('markdown');
            };

            input.addEventListener('input', handleInput);

            // Keep input focused when interacting with results (prevent blur on click)
            results.addEventListener('mousedown', (e) => {
                // prevent the browser from moving focus away on mousedown
                e.preventDefault();
                try { input.focus(); } catch (err) {}
            });

            /**
             * Keyboard navigation for the results list (ArrowUp/Down, Tab, Enter).
             * @param {KeyboardEvent} e
             * @returns {void}
             */
            const handleNavKeyDown = (e) => {
                const items = getItems();
                if (!items.length) return;

                if (e.key === 'ArrowDown' || e.code === 'ArrowDown') {
                    e.preventDefault();
                    const next = activeIndex + 1;
                    setActive(next);
                    return;
                }

                if (e.key === 'ArrowUp' || e.code === 'ArrowUp') {
                    e.preventDefault();
                    const prev = activeIndex - 1;
                    setActive(prev);
                    return;
                }

                if (e.key === 'Tab') {
                    e.preventDefault();
                    const next = activeIndex + 1;
                    setActive(next);
                    return;
                }

                if (e.key === 'Enter') {
                    if (activeIndex >= 0) {
                        e.preventDefault();
                        const sel = getItems()[activeIndex];
                        if (sel) sel.click();
                    }
                }
            };

            input.addEventListener('keydown', handleNavKeyDown);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    hide();
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && isVisible) {
                    hide();
                }
            });

            /**
             * Remove event handlers created by init and perform any necessary cleanup.
             * @returns {void}
             */
            const destroy = () => {
                input.removeEventListener('input', handleInput);
                input.removeEventListener('keydown', handleNavKeyDown);
            };

            return {
                show,
                hide,
                toggle,
                showMarkdownCommands,
                destroy
            };
        }
    };
};