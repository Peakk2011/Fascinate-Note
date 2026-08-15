import { insertImagesFromFiles } from '../../scripts/editor/handlePaste.js';

const MENU_OFFSET = 12;
const MENU_HIDE_DELAY = 0;
const SELECTION_THROTTLE_MS = 80;
const LARGE_DOC_THRESHOLD = 50000;

const unwrapMark = (markEl) => {
    if (!markEl || !markEl.parentNode) return;
    const parent = markEl.parentNode;

    while (markEl.firstChild) {
        parent.insertBefore(markEl.firstChild, markEl);
    }

    parent.removeChild(markEl);
    parent.normalize?.();
};

const applyHighlight = (range, selection) => {
    if (!range || range.collapsed) return;

    // Protect nested <mark>
    const ancestor = range.commonAncestorContainer;
    const ancestorEl = ancestor?.nodeType === Node.TEXT_NODE
        ? ancestor.parentElement
        : ancestor;
    if (ancestorEl?.closest?.('mark')) return;

    const mark = document.createElement('mark');
    mark.className = 'selection-highlight';

    const fragment = range.extractContents();
    if (!fragment || !fragment.textContent?.trim()) return;

    mark.appendChild(fragment);
    range.insertNode(mark);

    const nextRange = document.createRange();
    nextRange.selectNodeContents(mark);
    selection.removeAllRanges();
    selection.addRange(nextRange);
};

/**
 * Returns viewport padding based on the root font size.
 * @returns {number} - Padding in pixels.
 */
const getViewportPadding = () => {
    return parseFloat(
        getComputedStyle(
            document.documentElement
        ).fontSize
    ) * 1;
}

/**
 * Calculates the optimal position for the selection menu
 * relative to the current text selection.
 *
 * @param {DOMRect} selectionRect
 *        Bounding rectangle of the selected text.
 *
 * @param {HTMLElement} selectionMenu
 *        The floating selection menu element.
 *
 * @returns {{ left: number, top: number }}
 *          Pixel coordinates for menu placement.
 */
const calculateMenuPosition = (selectionRect, selectionMenu) => {
    // Menu dimensions
    const menuWidth = selectionMenu.offsetWidth;
    const menuHeight = selectionMenu.offsetHeight;

    // Scroll offsets
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Viewport metrics
    const viewportWidth = window.innerWidth;
    const visualViewport = window.visualViewport || {
        width: window.innerWidth,
        height: window.innerHeight,
        offsetTop: 0,
    };

    const viewportHeight = visualViewport.height;
    const viewportOffsetTop = visualViewport.offsetTop || 0;

    const VIEWPORT_PADDING = getViewportPadding();

    /**
     * Horizontal positioning
     * Center menu relative to selection
     */
    let left =
        selectionRect.left +
        scrollX +
        (selectionRect.width - menuWidth) / 2;

    /**
     * Vertical positioning
     * Default: place menu below selection
     */
    let top =
        selectionRect.bottom +
        scrollY +
        MENU_OFFSET;

    /**
     * Clamp horizontal position within viewport bounds
     */
    if (left < scrollX + VIEWPORT_PADDING) {
        left = scrollX + VIEWPORT_PADDING;
    } else if (
        left + menuWidth >
        viewportWidth + scrollX - VIEWPORT_PADDING
    ) {
        left =
            viewportWidth +
            scrollX -
            menuWidth -
            VIEWPORT_PADDING;
    }

    /**
     * Handle vertical overflow (e.g. mobile keyboard)
     * Try placing the menu above the selection if needed
     */
    if (
        top + menuHeight >
        viewportOffsetTop + viewportHeight - VIEWPORT_PADDING
    ) {
        const alternativeTop =
            selectionRect.top +
            scrollY -
            menuHeight -
            MENU_OFFSET;

        if (alternativeTop > scrollY + VIEWPORT_PADDING) {
            top = alternativeTop;
        } else {
            top =
                viewportOffsetTop +
                viewportHeight +
                scrollY -
                menuHeight -
                VIEWPORT_PADDING;
        }
    }

    return { left, top };
};


/**
 * Updates active states of formatting buttons
 * based on the current document selection.
 *
 * @param {HTMLElement} selectionMenu
 *        Menu element containing command buttons.
 */
const updateButtonStates = (selectionMenu) => {
    const buttons =
        selectionMenu.querySelectorAll('button[data-command]');

    buttons.forEach((button) => {
        const { command, value } = button.dataset;

        /**
         * Special handling for block-level formatting
         */
        if (command === 'formatBlock') {
            const currentBlock =
                document
                    .queryCommandValue('formatBlock')
                    .toUpperCase();

            button.classList.toggle(
                'active',
                currentBlock === value
            );

            return;
        }

        /**
         * Inline formatting commands
         */
        if (command === 'justifyLeft' || command === 'justifyCenter' || command === 'justifyRight') {
            button.classList.toggle(
                'active',
                document.queryCommandState(command)
            );
        } else {
            button.classList.toggle(
                'active',
                document.queryCommandState(command)
            );
        }
    });
};


/**
 * Returns HTML markup string for the selection menu with formatting buttons.
 *
 * @returns {string} - HTML markup for selection menu.
 */
export const createSelectionMenuMarkup = () => {
    return `
        <div id="selection-menu" class="selection-menu">
            <button data-command="bold" title="Bold">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--theme-fg)"><path d="M272-200v-560h221q65 0 120 40t55 111q0 51-23 78.5T602-491q25 11 55.5 41t30.5 90q0 89-65 124.5T501-200H272Zm121-112h104q48 0 58.5-24.5T566-372q0-11-10.5-35.5T494-432H393v120Zm0-228h93q33 0 48-17t15-38q0-24-17-39t-44-15h-95v109Z"/></svg>
            </button>
            <button data-command="italic" title="Italic">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--theme-fg)"><path d="M200-200v-100h160l120-360H320v-100h400v100H580L460-300h140v100H200Z"/></svg>
            </button>
            <button data-command="underline" title="Underline">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--theme-fg)"><path d="M200-120v-80h560v80H200Zm123-223q-56-63-56-167v-330h103v336q0 56 28 91t82 35q54 0 82-35t28-91v-336h103v330q0 104-56 167t-157 63q-101 0-157-63Z"/></svg>
            </button>
            <button data-command="cropAndHighlight" title="Crop and Highlight">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--theme-fg)"><path d="M544-400 440-504 240-304l104 104 200-200Zm-47-161 104 104 199-199-104-104-199 199Zm-84-28 216 216-229 229q-24 24-56 24t-56-24l-2-2-26 26H60l126-126-2-2q-24-24-24-56t24-56l229-229Zm0 0 227-227q24-24 56-24t56 24l104 104q24 24 24 56t-24 56L629-373 413-589Z"/></svg>
            </button>
            <span class="separator"></span>
            <button data-command="formatBlock" data-value="H1" title="Heading 1">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--theme-fg)"><path d="M200-280v-400h80v160h160v-160h80v400h-80v-160H280v160h-80Zm480 0v-320h-80v-80h160v400h-80Z"/></svg>
            </button>
            <button data-command="formatBlock" data-value="H2" title="Heading 2">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--theme-fg)"><path d="M120-280v-400h80v160h160v-160h80v400h-80v-160H200v160h-80Zm400 0v-160q0-33 23.5-56.5T600-520h160v-80H520v-80h240q33 0 56.5 23.5T840-600v80q0 33-23.5 56.5T760-440H600v80h240v80H520Z"/></svg>
            </button>
            <!--
            <button data-command="formatBlock" data-value="H3" title="Heading 3">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--theme-fg)"><path d="M120-280v-400h80v160h160v-160h80v400h-80v-160H200v160h-80Zm400 0v-80h240v-80H600v-80h160v-80H520v-80h240q33 0 56.5 23.5T840-600v240q0 33-23.5 56.5T760-280H520Z"/></svg>
            </button>
            -->
            <span class="separator"></span>
            <!--
            <button data-command="formatBlock" data-value="BLOCKQUOTE" title="Blockquote">" "</button>
            -->
            <!-- <span class="separator"></span>
            <button data-command="insertUnorderedList" title="Unordered List">• List</button>
            <button data-command="insertOrderedList" title="Ordered List">1. List</button>
            -->
            <!-- alignment -->
            <button data-command="justifyLeft" title="Align left">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--theme-fg)"><path d="M120-120v-80h720v80H120Zm0-160v-80h480v80H120Zm0-160v-80h720v80H120Zm0-160v-80h480v80H120Zm0-160v-80h720v80H120Z"/></svg>
            </button>
            <button data-command="justifyCenter" title="Align center">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--theme-fg)"><path d="M120-120v-80h720v80H120Zm160-160v-80h400v80H280ZM120-440v-80h720v80H120Zm160-160v-80h400v80H280ZM120-760v-80h720v80H120Z"/></svg>
            </button>
            <button data-command="justifyRight" title="Align right">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--theme-fg)"><path d="M120-760v-80h720v80H120Zm240 160v-80h480v80H360ZM120-440v-80h720v80H120Zm240 160v-80h480v80H360ZM120-120v-80h720v80H120Z"/></svg>
            </button>
            <span class="separator"></span>
            <button data-command="insertImage" class="selection-menu-image-btn" title="Insert Image">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--theme-fg)"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Z"/></svg>
            </button>
        </div>
    `;
}

/**
 * Initializes the selection menu with event listeners for a given editor element.
 * @param {HTMLElement} editor                  - The editable container element.
 * @returns {{cleanup: function}}               - Object with a cleanup method to remove all event listeners.
 *
 * @example
 * const menuController = initSelectionMenu(editor);
 * // Later, to remove listeners:
 * menuController.cleanup();
 */
export const initSelectionMenu = (editor) => {
    const selectionMenu = document.getElementById('selection-menu');

    if (!editor || !selectionMenu) {
        return { cleanup: () => { } };
    }

    let selectionTimer = null;
    let lastPositionUpdate = 0;

    const isLargeDocument = () => {
        const length = Number(editor.dataset?.docLength || 0);
        return editor.dataset?.performanceMode === '1' || length >= LARGE_DOC_THRESHOLD;
    };

    const scheduleSelectionUpdate = () => {
        if (selectionTimer) return;

        const delay = isLargeDocument()
            ? Math.max(SELECTION_THROTTLE_MS * 2, 140)
            : SELECTION_THROTTLE_MS;

        selectionTimer = setTimeout(() => {
            selectionTimer = null;
            showSelectionMenu();
        }, delay);
    };

    const isImageSelection = (range) => {
        if (!range) return false;

        const node = range.commonAncestorContainer;
        const element = node.nodeType === Node.ELEMENT_NODE
            ? node
            : node.parentElement;

        if (element?.closest?.('.image-block')) {
            return true;
        }

        if (range.startContainer === editor && range.endContainer === editor) {
            const nodes = Array.from(editor.childNodes)
                .slice(range.startOffset, range.endOffset);
            return nodes.some((child) => {
                if (child.nodeType !== Node.ELEMENT_NODE) return false;
                if (child.classList?.contains('image-block')) return true;
                return Boolean(child.querySelector?.('img'));
            });
        }

        return false;
    };

    /**
     * Shows or hides the selection menu based on current selection.
     */
    const showSelectionMenu = () => {
        try {
            const selection = window.getSelection();

            if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
                selectionMenu.classList.remove('show');
                return;
            }

            const range = selection.getRangeAt(0);
            if (!editor.contains(range.commonAncestorContainer)) {
                selectionMenu.classList.remove('show');
                return;
            }

            if (isImageSelection(range)) {
                selectionMenu.classList.remove('show');
                return;
            }

            const largeDoc = isLargeDocument();
            const alreadyVisible = selectionMenu.classList.contains('show');

            const now = Date.now();
            const shouldUpdatePosition =
                !largeDoc ||
                !alreadyVisible ||
                (now - lastPositionUpdate) > 350;

            if (shouldUpdatePosition) {
                const rect = range.getBoundingClientRect();
                const position = calculateMenuPosition(rect, selectionMenu);

                selectionMenu.style.left = `${position.left}px`;
                selectionMenu.style.top = `${position.top}px`;
                lastPositionUpdate = now;

                if (!largeDoc) {
                    // Trigger reflow for CSS transitions
                    void selectionMenu.offsetWidth;
                }
            }

            selectionMenu.classList.add('show');

            if (!largeDoc) {
                updateButtonStates(selectionMenu);
            }
        } catch (error) {
            console.error('Error showing selection menu:', error);
            selectionMenu.classList.remove('show');
        }
    };

    /**
     * Handles clicks on the menu buttons and executes corresponding commands.
     * @param {MouseEvent} e - The click event.
     */
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/png,image/jpeg,image/jpg,image/webp';
    imageInput.className = 'selection-menu-file-input';

    const handleImageChange = () => {
        const files = Array.from(imageInput.files || []);
        if (!files.length) return;
        insertImagesFromFiles(files, editor);
        imageInput.value = '';
    };

    imageInput.addEventListener('change', handleImageChange);

    selectionMenu.appendChild(imageInput);

    const handleMenuClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const button = e.target.closest('button');
        if (!button) return;

        const command = button.dataset.command;
        const value = button.dataset.value || null;

        if (command === 'insertImage') {
            imageInput.click();
        } else if (command === 'cropAndHighlight') {
            const selection = window.getSelection();

            if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);
            const originalRange = range.cloneRange();

            const anchorMark = selection.anchorNode?.parentElement?.closest?.('mark');
            const focusMark = selection.focusNode?.parentElement?.closest?.('mark');
            const isMark = anchorMark && anchorMark === focusMark;

            if (!isMark) {
                const startContainer = originalRange.startContainer;
                const endContainer = originalRange.endContainer;

                const startText = startContainer.textContent ?? '';
                let startOffset = originalRange.startOffset;
                while (startOffset > 0 && /\S/.test(startText[startOffset - 1])) {
                    startOffset--;
                }

                const endText = endContainer.textContent ?? '';
                let endOffset = originalRange.endOffset;
                while (endOffset < endText.length && /\S/.test(endText[endOffset])) {
                    endOffset++;
                }

                const finalRange = document.createRange();
                finalRange.setStart(startContainer, startOffset);
                finalRange.setEnd(endContainer, endOffset);

                selection.removeAllRanges();
                selection.addRange(finalRange);
            }

            if (isMark) {
                // Using anchorMark
                unwrapMark(anchorMark);
            } else {
                // Check the rangeCount again and modify (Maybe selection will chenged)
                if (selection.rangeCount === 0) return;
                applyHighlight(selection.getRangeAt(0), selection);
            }
        } else if (command === 'formatBlock') {
            try {
                const currentValue = document.queryCommandValue('formatBlock').toUpperCase();
                const newValue = (currentValue === value) ? 'P' : value;

                document.execCommand(
                    command,
                    false,
                    newValue
                );
            } catch (error) {
                console.error('Error executing formatBlock command:', error);
            }
        } else if (command) {
            try {
                const selection = window.getSelection();
                const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

                document.execCommand(command, false, value);

                if (range && selection.rangeCount === 0) {
                    selection.addRange(range);
                }
            } catch (error) {
                console.error('Error executing command:', error);
            }
        }

        setTimeout(showSelectionMenu, MENU_HIDE_DELAY);
    };

    /**
     * Handles editor blur event to hide the menu after a small delay.
     */
    const handleEditorBlur = () => {
        setTimeout(() => {
            if (!selectionMenu.matches(':hover')) {
                selectionMenu.classList.remove('show');
            }
        }, 100);
    };

    // Attach event listeners
    const handleSelectionChange = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            if (selectionMenu.classList.contains('show')) {
                selectionMenu.classList.remove('show');
            }
            return;
        }

        const range = selection.getRangeAt(0);
        if (isImageSelection(range)) {
            if (selectionMenu.classList.contains('show')) {
                selectionMenu.classList.remove('show');
            }
            return;
        }

        scheduleSelectionUpdate();
    };

    document.addEventListener(
        'selectionchange',
        handleSelectionChange
    );

    editor.addEventListener(
        'blur',
        handleEditorBlur
    );

    selectionMenu.addEventListener(
        'mousedown',
        handleMenuClick
    );

    return {
        cleanup() {
            document.removeEventListener(
                'selectionchange',
                handleSelectionChange
            );

            editor.removeEventListener(
                'blur',
                handleEditorBlur
            );

            selectionMenu.removeEventListener(
                'mousedown',
                handleMenuClick
            );
            imageInput.removeEventListener('change', handleImageChange);
            if (imageInput.parentElement) {
                imageInput.parentElement.removeChild(imageInput);
            }

            if (selectionTimer) {
                clearTimeout(selectionTimer);
                selectionTimer = null;
            }
        }
    };
}