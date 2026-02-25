/**
 * Parse markdown syntax in pasted text and convert to HTML elements.
 * Supports nested lists, nested blockquotes, and inline formatting.
 *
 * @param {string} text - Plain text that may contain markdown syntax
 * @returns {string} HTML with markdown patterns converted to elements
 */

const parseMarkdownInPastedText = (text) => {
    const lines = text.split('\n');
    const result = [];
    let i = 0;

    /**
     * Parse inline markdown: bold, italic, strikethrough, code, mark, HTML mark tag
     * Order matters — bold+italic (***) before bold (**) before italic (*)
     *
     * @param {string} text
     * @returns {string}
     */
    const parseInline = (text) => {
        // Allow <mark>...</mark> passthrough (don't escape it)
        // We'll handle escaping carefully: escape everything except <mark> tags
        let result = '';
        const markTagRegex = /(<mark>[\s\S]*?<\/mark>)/g;
        const parts = text.split(markTagRegex);

        for (const part of parts) {
            if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
                result += part; // pass through as-is
                continue;
            }

            let s = escapeHTML(part);
            // Bold + Italic: ***text*** or ___text___
            s = s.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
            s = s.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
            // Bold: **text** or __text__
            s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            s = s.replace(/__(.*?)__/g, '<strong>$1</strong>');
            // Italic: *text* or _text_
            s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
            s = s.replace(/_(.*?)_/g, '<em>$1</em>');
            // Strikethrough: ~~text~~
            s = s.replace(/~~(.*?)~~/g, '<s>$1</s>');
            // Inline code: `code`
            s = s.replace(/`([^`]+)`/g, '<code>$1</code>');

            result += s;
        }

        return result;
    };

    /**
     * Detect list indentation level based on leading spaces.
     * Every 2 spaces = 1 level deeper.
     *
     * @param {string} rawLine - Original line before trimming
     * @returns {number} 0-based depth level
     */
    const getIndentLevel = (rawLine) => {
        const match = rawLine.match(/^(\s*)/);
        return match ? Math.floor(match[1].length / 2) : 0;
    };

    /**
     * Collect and build a nested <ul> or <ol> block starting at index i.
     * Returns [htmlString, newIndex] after consuming all related list lines.
     *
     * @param {string[]} lines
     * @param {number} startIndex
     * @param {'ul'|'ol'} listType
     * @param {number} baseIndent - indent level of the first item
     * @returns {[string, number]}
     */
    const buildList = (lines, startIndex, listType, baseIndent) => {
        /**
         * Recursively build list items for a given indent level.
         *
         * @param {number} idx - current line index
         * @param {number} depth - current nesting depth
         * @returns {[string, number]} [html, nextIndex]
         */
        const buildLevel = (idx, depth) => {
            let html = '';
            const tag = listType;

            while (idx < lines.length) {
                const rawLine = lines[idx];
                const trimmed = rawLine.trim();
                const indent = getIndentLevel(rawLine);
                const isUl = /^-\s+/.test(trimmed);
                const isOl = /^\d+\.\s+/.test(trimmed);

                if (!isUl && !isOl) break; // not a list line anymore
                if (indent < depth + baseIndent) break; // went back up

                if (indent === depth + baseIndent) {
                    // Same level: add <li>
                    const content = isUl
                        ? trimmed.replace(/^-\s+/, '')
                        : trimmed.replace(/^\d+\.\s+/, '');

                    // Peek ahead: next line might be deeper (nested list)
                    idx++;
                    let nestedHtml = '';

                    if (idx < lines.length) {
                        const nextIndent = getIndentLevel(lines[idx]);
                        const nextTrimmed = lines[idx].trim();
                        const nextIsList = /^-\s+/.test(nextTrimmed) || /^\d+\.\s+/.test(nextTrimmed);

                        if (nextIsList && nextIndent > indent) {
                            // Detect nested list type
                            const nestedType = /^\d+\.\s+/.test(nextTrimmed) ? 'ol' : 'ul';
                            let nested;
                            [nested, idx] = buildLevel(idx, depth + (nextIndent - (depth + baseIndent)));
                            nestedHtml = `<${nestedType}>${nested}</${nestedType}>`;
                        }
                    }

                    html += `<li>${parseInline(content)}${nestedHtml}</li>`;
                } else {
                    // Deeper indent handled by recursive peek above — skip
                    idx++;
                }
            }

            return [html, idx];
        };

        const [html, nextIdx] = buildLevel(startIndex, 0);
        return [`<${listType}>${html}</${listType}>`, nextIdx];
    };

    /**
     * Build nested blockquote HTML from lines starting at startIndex.
     * Handles >, >>, >>> by counting leading > characters.
     *
     * @param {string[]} lines
     * @param {number} startIndex
     * @returns {[string, number]}
     */
    const buildBlockquote = (lines, startIndex) => {
        /**
         * Count how many leading > chars a blockquote line has.
         * @param {string} trimmed
         * @returns {number}
         */
        const getQuoteDepth = (trimmed) => {
            const match = trimmed.match(/^(>+)\s*/);
            return match ? match[1].length : 0;
        };

        /**
         * Recursively wrap content in nested <blockquote> tags.
         * @param {string[]} items - [{depth, content}]
         * @param {number} level
         * @returns {string}
         */
        const nestQuotes = (items, level) => {
            let html = '';
            let j = 0;
            while (j < items.length) {
                if (items[j].depth === level) {
                    html += parseInline(items[j].content);
                    j++;
                } else if (items[j].depth > level) {
                    // Collect deeper items
                    const sub = [];
                    while (j < items.length && items[j].depth > level) {
                        sub.push(items[j]);
                        j++;
                    }
                    html += `<blockquote>${nestQuotes(sub, level + 1)}</blockquote>`;
                } else {
                    break;
                }
            }
            return html;
        };

        const items = [];
        let idx = startIndex;

        while (idx < lines.length) {
            const trimmed = lines[idx].trim();
            const depth = getQuoteDepth(trimmed);
            if (depth === 0) break;
            const content = trimmed.replace(/^>+\s*/, '');
            items.push({ depth, content });
            idx++;
        }

        const html = `<blockquote>${nestQuotes(items, 1)}</blockquote>`;
        return [html, idx];
    };

    while (i < lines.length) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        // --- Headings: # ## ### ####
        const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            result.push(`<h${level}>${parseInline(headingMatch[2])}</h${level}>`);
            i++;
            continue;
        }

        // --- Blockquotes: > >> >>>
        if (/^>+\s/.test(trimmed)) {
            const [html, nextIdx] = buildBlockquote(lines, i);
            result.push(html);
            i = nextIdx;
            continue;
        }

        // --- Unordered list: - item
        if (/^-\s+/.test(trimmed)) {
            const indent = getIndentLevel(rawLine);
            const [html, nextIdx] = buildList(lines, i, 'ul', indent);
            result.push(html);
            i = nextIdx;
            continue;
        }

        // --- Ordered list: 1. item
        if (/^\d+\.\s+/.test(trimmed)) {
            const indent = getIndentLevel(rawLine);
            const [html, nextIdx] = buildList(lines, i, 'ol', indent);
            result.push(html);
            i = nextIdx;
            continue;
        }

        // --- Paragraph or blank line
        if (trimmed) {
            result.push(`<div>${parseInline(trimmed)}</div>`);
        } else {
            result.push('<br>');
        }

        i++;
    }

    return result.join('');
};

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
 * - Parses markdown syntax in pasted text (# ## > - 1. etc.)
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
            // Check if text contains markdown patterns
            const hasMarkdown = /^(#{1,4}|>|-|\d+\.)\s/.test(text);
            
            if (hasMarkdown) {
                // Parse markdown patterns in the pasted text
                return parseMarkdownInPastedText(text);
            }
            
            // Regular plain text: convert line breaks to divs
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
                
                // First extract raw text to check for markdown patterns
                const rawText = temp.textContent || '';
                const hasMarkdown = /^(#{1,4}|>|-|\d+\.)\s/m.test(rawText);
                
                if (hasMarkdown) {
                    // Parse markdown patterns from the text content
                    content = parseMarkdownInPastedText(rawText);
                } else {
                    // Format as normal HTML
                    content = formatPastedHTML(temp);
                }
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

        // Determine if pasting into a heading or formatted block
        let parentElement = range.startContainer;
        if (parentElement.nodeType === Node.TEXT_NODE) {
            parentElement = parentElement.parentNode;
        }

        let isInsideHeading = false;
        let insideBlockTag = null;
        let currentNode = parentElement;
        while (currentNode && currentNode !== editor) {
            if (['H1','H2','H3','H4','H5','H6'].includes(currentNode.tagName)) {
                isInsideHeading = true;
                insideBlockTag = currentNode.tagName;
                break;
            }
            if (['BLOCKQUOTE','PRE'].includes(currentNode.tagName)) {
                insideBlockTag = currentNode.tagName;
                break;
            }
            currentNode = currentNode.parentNode;
        }

        // If pasting into a formatted block, strip block-level tags but keep inline formatting
        let finalContent = content;
        if (isInsideHeading || insideBlockTag) {
            finalContent = stripBlockTagsInContent(content);
        }

        // Create and insert the cleaned HTML
        const fragment = document.createDocumentFragment();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = finalContent;

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
 * Strip block-level tags when pasting into formatted blocks
 * Preserves inline formatting (bold, italic, etc.)
 * 
 * @param {string} html - HTML content
 * @returns {string} Content with block tags removed but inline tags preserved
 */
const stripBlockTagsInContent = (html) => {
    let result = '';
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const processNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            let childContent = '';

            for (const child of node.childNodes) {
                childContent += processNode(child);
            }

            // Keep inline formatting tags
            if (['strong', 'b', 'em', 'i', 'u', 's', 'code', 'span'].includes(tag)) {
                return `<${tag}>${childContent}</${tag}>`;
            }

            // Strip block-level tags but keep content
            if (['h1','h2','h3','h4','h5','h6','p','ul','ol','li','blockquote','pre','div'].includes(tag)) {
                // Add space between block elements
                return childContent ? childContent + ' ' : '';
            }

            // Keep br
            if (tag === 'br') return '<br>';

            // Return content for unknown tags
            return childContent;
        }

        return '';
    };

    for (const child of temp.childNodes) {
        result += processNode(child);
    }

    // Clean up multiple spaces
    result = result.replace(/\s+/g, ' ').trim();

    return result;
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