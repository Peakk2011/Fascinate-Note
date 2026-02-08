const MENU_OFFSET = 12;
const MENU_HIDE_DELAY = 0;
const SELECTION_THROTTLE_MS = 80;
const LARGE_DOC_THRESHOLD = 50000;

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
        button.classList.toggle(
            'active',
            document.queryCommandState(command)
        );
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
            <button data-command="bold" title="Bold"><b>B</b></button>
            <button data-command="italic" title="Italic"><i>I</i></button>
            <button data-command="underline" title="Underline"><u>U</u></button>
            <span class="separator"></span>
            <button data-command="formatBlock" data-value="H1" title="Heading 1">H1</button>
            <button data-command="formatBlock" data-value="H2" title="Heading 2">H2</button>
            <button data-command="formatBlock" data-value="H3" title="Heading 3">H3</button>
            <span class="separator"></span>
            <button data-command="formatBlock" data-value="BLOCKQUOTE" title="Blockquote">" "</button>
            <span class="separator"></span>
            <button data-command="insertUnorderedList" title="Unordered List">• List</button>
            <button data-command="insertOrderedList" title="Ordered List">1. List</button>
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
    const handleMenuClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const button = e.target.closest('button');
        if (!button) return;

        const command = button.dataset.command;
        const value = button.dataset.value || null;

        if (command === 'formatBlock') {
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

            if (selectionTimer) {
                clearTimeout(selectionTimer);
                selectionTimer = null;
            }
        }
    };
}
