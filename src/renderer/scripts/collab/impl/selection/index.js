export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const getSelectionOffsets = (root) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
        return null;
    }

    const startRange = document.createRange();
    startRange.setStart(root, 0);
    startRange.setEnd(range.startContainer, range.startOffset);

    const endRange = document.createRange();
    endRange.setStart(root, 0);
    endRange.setEnd(range.endContainer, range.endOffset);

    return {
        start: startRange.toString().length,
        end: endRange.toString().length
    };
};

export const createRangeFromOffset = (root, offset) => {
    const range = document.createRange();
    let remaining = offset;

    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        null
    );

    let node = walker.nextNode();
    while (node) {
        const text = node.textContent || '';
        if (remaining <= text.length) {
            range.setStart(node, remaining);
            range.collapse(true);
            return range;
        }
        remaining -= text.length;
        node = walker.nextNode();
    }

    range.setStart(root, root.childNodes.length);
    range.collapse(true);
    return range;
};

export const restoreSelection = (root, offsets) => {
    if (!offsets) return;
    const selection = window.getSelection();
    if (!selection) return;

    const maxLen = (root.textContent || '').length;
    const start = clamp(offsets.start, 0, maxLen);
    const end = clamp(offsets.end, 0, maxLen);

    const startRange = createRangeFromOffset(root, start);
    const endRange = createRangeFromOffset(root, end);

    const range = document.createRange();
    range.setStart(startRange.startContainer, startRange.startOffset);
    range.setEnd(endRange.startContainer, endRange.startOffset);

    selection.removeAllRanges();
    selection.addRange(range);
};