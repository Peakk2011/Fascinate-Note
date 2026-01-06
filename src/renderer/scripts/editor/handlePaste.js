/**
 * Handle paste event, sanitizing and preserving rich formatting.
 * This function intercepts paste events to ensure only safe HTML formatting
 * is preserved while stripping potentially dangerous or unwanted elements.
 * 
 * @param {ClipboardEvent} e        - The paste event triggered by user action
 * @param {HTMLElement} editor      - The contenteditable editor element receiving the paste
 * @returns {void}
 * 
 * @example
 * // Attach to editor element
 * editor.addEventListener('paste', (e) => handlePaste(e, editor));
 * 
 * @throws {Error} Logs error to console if paste operation fails
 * 
 * @features
 * - Preserves text formatting (bold, italic, underline, strikethrough)
 * - Maintains block-level elements (headings, lists, blockquotes, code blocks)
 * - Sanitizes dangerous HTML and scripts
 * - Smooth fade-in animation for pasted content
 * - Maintains cursor position after paste
 */
export const handlePaste = (e, editor) => {
    try {
        e.preventDefault();

        // Extract clipboard data
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) {
            console.warn('Clipboard data not available');
            return;
        }

        const html = clipboardData.getData('text/html');
        const text = clipboardData.getData('text/plain');

        /** @type {string} */
        let content;

        const processPlainText = (text) => {
            const lines = text.split('\n');
            if (lines.length > 1 || text.endsWith('\n')) {
                return lines.map(line => `<div>${escapeHTML(line) || '<br>'}</div>`).join('');
            }
            return escapeHTML(text);
        };

        if (html) {
            try {
                const temp = document.createElement('div');
                temp.innerHTML = html;
                content = formatPastedHTML(temp);
            } catch (parseError) {
                console.error('HTML parsing failed, falling back to plain text:', parseError);
                content = processPlainText(text);
            }
        } else {
            content = processPlainText(text);
        }

        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) {
            console.warn('No text selection available');
            return;
        }

        const range = selection.getRangeAt(0);
        try {
            range.deleteContents();
        } catch (deleteError) {
            console.error('Failed to delete selected content:', deleteError);
            return;
        }

        // Determine if pasting into a heading
        let parentElement = range.startContainer;
        if (parentElement.nodeType === Node.TEXT_NODE) {
            parentElement = parentElement.parentNode;
        }

        let isInsideHeading = false;
        let currentNode = parentElement;
        while (currentNode && currentNode !== editor) {
            if (['H1','H2','H3','H4','H5','H6'].includes(currentNode.tagName)) {
                isInsideHeading = true;
                break;
            }
            currentNode = currentNode.parentNode;
        }

        // Create and insert the cleaned HTML
        const fragment = document.createDocumentFragment();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = content;

        // Use a div for fade-in effect
        const pastedWrapper = document.createElement('div');
        pastedWrapper.style.opacity = '0';
        pastedWrapper.style.transition = 'opacity 0.2s ease-in';
        if (!isInsideHeading) pastedWrapper.classList.add('pasted-content');

        while (wrapper.firstChild) {
            pastedWrapper.appendChild(wrapper.firstChild);
        }

        fragment.appendChild(pastedWrapper);

        try {
            range.insertNode(fragment);
        } catch (insertError) {
            console.error('Failed to insert pasted content:', insertError);
            return;
        }

        // Animate fade-in
        requestAnimationFrame(() => {
            setTimeout(() => {
                pastedWrapper.style.opacity = '1';
            }, 20);
        });

        // Move cursor to end of pasted content
        const lastNode = pastedWrapper.lastChild;
        if (lastNode) {
            const newRange = document.createRange();
            newRange.setStartAfter(lastNode);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        // Trigger input event
        try {
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (eventError) {
            console.error('Failed to dispatch input event:', eventError);
        }

    } catch (error) {
        console.error('Paste operation failed:', error);
        console.warn('Could not paste content. Please try again.');
    }
};

/**
 * Sanitize and format pasted HTML content by keeping a safe subset of tags.
 * 
 * @param {HTMLElement} element - The element containing the pasted HTML to be sanitized
 * @returns {string} Cleaned and formatted HTML string with only allowed tags
 * 
 * @throws {Error} Throws if element is not a valid HTMLElement
 */
const formatPastedHTML = (element) => {
    if (!(element instanceof HTMLElement)) {
        throw new Error('formatPastedHTML requires a valid HTMLElement');
    }

    let result = '';

    const processNode = (node) => {
        try {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                return escapeHTML(text.replace(/\u00A0/g, ' '));
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toLowerCase();
                let childContent = '';

                for (const child of node.childNodes) {
                    try {
                        childContent += processNode(child);
                    } catch (childError) {
                        console.warn('Failed to process child node:', childError);
                    }
                }

                if (['b','strong'].includes(tag)) return childContent ? `<strong>${childContent}</strong>` : '';
                if (['i','em'].includes(tag)) return childContent ? `<em>${childContent}</em>` : '';
                if (['u'].includes(tag)) return childContent ? `<u>${childContent}</u>` : '';
                if (['s','strike','del'].includes(tag)) return childContent ? `<s>${childContent}</s>` : '';
                if (['h1','h2','h3','h4','h5','h6','p','ul','ol','li','blockquote','pre','code'].includes(tag)) {
                    if (!childContent.trim()) return '';
                    return `<${tag}>${childContent}</${tag}>`;
                }
                if (tag === 'br') return '<br>';
                if (tag === 'div') return node.childNodes.length > 0 ? `<div>${childContent}</div>` : '<br>';
                return childContent;
            }

            return '';
        } catch (nodeError) {
            console.error('Error processing node:', nodeError);
            return '';
        }
    };

    for (const child of element.childNodes) {
        try {
            result += processNode(child);
        } catch (childError) {
            console.warn('Failed to process top-level child:', childError);
        }
    }

    // Cleanup multiple <br>
    result = result.replace(/(<br>\s*){3,}/g, '<br><br>');
    result = result.replace(/^(<br>\s*)+|(<br>\s*)+$/g, '');
    result = result.replace(/<(strong|em|u|s)>\s*<\/\1>/g, '');

    return result.trim();
};

/**
 * Escape HTML special characters to prevent XSS attacks
 * 
 * @param {string} text - Text to escape
 * @returns {string} HTML-safe text with special characters escaped
 */
const escapeHTML = (text) => {
    if (typeof text !== 'string') return '';

    const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, (char) => escapeMap[char] || char);
};
