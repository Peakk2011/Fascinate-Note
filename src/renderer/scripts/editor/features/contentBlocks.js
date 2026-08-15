/**
 * Content block system for large documents.
 * Splits editor children into blocks to reduce render cost.
 */

const DEFAULTS = {
    threshold: 60000,
    blockCharLimit: 6000,
    blockNodeLimit: 30,
    rewrapDelta: 4000,
    debounce: 250,
    idleTimeout: 800
};

/**
 * Initialize content block wrapper for an editor.
 * @param {HTMLElement} editor
 * @param {Object} options
 * @returns {{update: Function, destroy: Function}}
 */
export const initContentBlocks = (editor, options = {}) => {
    const config = { ...DEFAULTS, ...options };

    let pendingTimer = null;
    let idleHandle = null;
    let isWrapping = false;
    let lastLength = 0;
    let lastWrapLength = 0;

    const clearTimers = () => {
        if (pendingTimer) {
            clearTimeout(pendingTimer);
            pendingTimer = null;
        }
        if (idleHandle && typeof cancelIdleCallback === 'function') {
            cancelIdleCallback(idleHandle);
            idleHandle = null;
        }
    };

    const captureSelection = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;

        return {
            anchorNode: selection.anchorNode,
            anchorOffset: selection.anchorOffset,
            focusNode: selection.focusNode,
            focusOffset: selection.focusOffset
        };
    };

    const restoreSelection = (snapshot) => {
        if (!snapshot) return;

        const selection = window.getSelection();
        if (!selection) return;

        try {
            const range = document.createRange();
            range.setStart(snapshot.anchorNode, snapshot.anchorOffset);
            range.setEnd(snapshot.focusNode, snapshot.focusOffset);
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (error) {
            // Ignore restore failures caused by DOM restructuring.
        }
    };

    const collectTopLevelNodes = () => {
        const nodes = [];

        editor.childNodes.forEach((node) => {
            if (
                node.nodeType === Node.ELEMENT_NODE &&
                node.classList.contains('editor-block')
            ) {
                nodes.push(...Array.from(node.childNodes));
            } else {
                nodes.push(node);
            }
        });

        return nodes;
    };

    const normalizeNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const wrapper = document.createElement('div');
            wrapper.appendChild(node);
            return wrapper;
        }
        return node;
    };

    const buildBlocks = (nodes) => {
        if (nodes.length === 0) return;

        let block = null;
        let charCount = 0;
        let nodeCount = 0;

        const createBlock = () => {
            block = document.createElement('section');
            block.className = 'editor-block';
            editor.appendChild(block);
            charCount = 0;
            nodeCount = 0;
        };

        createBlock();

        nodes.forEach((node) => {
            const normalizedNode = normalizeNode(node);
            const nodeChars = (normalizedNode.textContent || '').length;

            if (
                block &&
                nodeCount > 0 &&
                (nodeCount >= config.blockNodeLimit ||
                    charCount + nodeChars > config.blockCharLimit)
            ) {
                createBlock();
            }

            block.appendChild(normalizedNode);
            charCount += nodeChars;
            nodeCount += 1;
        });
    };

    const wrapNow = () => {
        if (isWrapping) return;
        if (lastLength < config.threshold) return;

        const nodes = collectTopLevelNodes();
        if (nodes.length === 0) return;

        isWrapping = true;

        const selectionSnapshot = captureSelection();
        const scrollTop = editor.scrollTop;

        while (editor.firstChild) {
            editor.removeChild(editor.firstChild);
        }

        buildBlocks(nodes);

        editor.scrollTop = scrollTop;
        restoreSelection(selectionSnapshot);

        lastWrapLength = lastLength;
        isWrapping = false;
    };

    const scheduleWrap = (delay = config.debounce) => {
        clearTimers();

        pendingTimer = setTimeout(() => {
            const run = () => {
                idleHandle = null;
                wrapNow();
            };

            if (typeof requestIdleCallback === 'function') {
                idleHandle = requestIdleCallback(run, { timeout: config.idleTimeout });
            } else {
                run();
            }
        }, delay);
    };

    const update = (length) => {
        lastLength = length;

        if (length < config.threshold) return;

        const hasBlocks = Boolean(editor.querySelector('.editor-block'));
        const lengthDelta = length - lastWrapLength;

        if (!hasBlocks || lengthDelta >= config.rewrapDelta) {
            scheduleWrap();
        }
    };

    const destroy = () => {
        clearTimers();
    };

    return { update, destroy };
};

export default initContentBlocks;
