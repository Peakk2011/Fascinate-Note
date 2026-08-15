/**
 * Set cursor at end of element
 * @param {HTMLElement} element - Target element
 * @param {Selection} selection - Window selection
 */
const setCursorAtEnd = (element, selection) => {
    const newRange = document.createRange();

    if (element.firstChild) {
        if (element.firstChild.nodeType === Node.TEXT_NODE) {
            newRange.setStart(
                element.firstChild,
                element.firstChild.length
            );
        } else {
            newRange.setStart(element, 0);
        }
    } else {
        newRange.setStart(element, 0);
    }

    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
};

/**
 * Handle Enter key in code blocks to return to normal paragraph
 * @param {KeyboardEvent} e - Event
 * @param {HTMLElement} currentElement - Current element
 * @param {Selection} selection - Window selection
 * @returns {boolean} Whether handled
 */
export const handleCodeBlockExit = (e, currentElement, selection) => {
    if (!currentElement) return false;

    const element = currentElement.nodeType === Node.ELEMENT_NODE
        ? currentElement
        : currentElement.parentElement;

    if (!element || typeof element.closest !== 'function') {
        return false;
    }

    const codeElement = element.closest('code');
    const preElement = element.closest('pre');

    if (codeElement && preElement) {
        e.preventDefault();

        const newP = document.createElement('p');
        newP.innerHTML = '<br>';
        preElement.after(newP);

        setCursorAtEnd(newP, selection);
        return true;
    }

    return false;
};

/*
    Update 2026-02-25 Version 1.0.12
    Inline Markdown Formatting
    Triggers on every keypress when the closing character of a pattern is typed.

    Supported patterns:
        ***text***  →  <strong><em>text</em></strong>
        **text**    →  <strong>text</strong>
        *text*      →  <em>text</em>
        ~~text~~    →  <s>text</s>
        `text`      →  <code>text</code>
*/

/**
 * Apply inline markdown formatting when the user finishes typing a pattern.
 * Call this on EVERY keydown event (not just Enter).
 *
 * @param {KeyboardEvent} e             - Keyboard event
 * @param {string} beforeCursor         - Text content before the cursor position
 * @param {HTMLElement} blockElement    - The current block-level element 
 * @param {Selection} selection         - Current window selection
 * @returns {boolean}                   - Whether a pattern was matched and replaced
 */
export const processInlineMarkdown = (e, beforeCursor, blockElement, selection) => {
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;

    // Only operate on text nodes
    if (textNode.nodeType !== Node.TEXT_NODE) return false;

    /**
     * Replace matched inline pattern with an HTML element,
     * preserving text before and after the match in the same text node.
     *
     * @param {RegExp} pattern          - Regex that matches the full pattern at end of string, capturing inner content
     * @param {string} tag              - Outer HTML tag (e.g. 'strong', 'em', 'code', 's')
     * @param {string|null} innerTag    - Optional inner tag for nested wrapping (e.g. 'em' inside 'strong')
     * @returns {boolean}               - Whether replacement happened
     */
    const replaceInlinePattern = (pattern, tag, innerTag = null) => {
        const fullText = textNode.textContent;
        const cursorOffset = range.startOffset;

        const textUpToCursor = fullText.slice(0, cursorOffset);
        const match = textUpToCursor.match(pattern);
        if (!match) return false;

        const matchStart = textUpToCursor.lastIndexOf(match[0]);
        const matchEnd = matchStart + match[0].length;
        const content = match[1];

        const before = fullText.slice(0, matchStart);
        const after = fullText.slice(matchEnd);

        // Build replacement element
        const el = document.createElement(tag);
        if (innerTag) {
            const inner = document.createElement(innerTag);
            inner.textContent = content;
            el.appendChild(inner);
        } else {
            el.textContent = content;
        }

        const beforeNode = document.createTextNode(before);
        const afterNode = document.createTextNode('\u200B' + after);

        const parent = textNode.parentNode;
        parent.insertBefore(beforeNode, textNode);
        parent.insertBefore(el, textNode);
        parent.insertBefore(afterNode, textNode);
        parent.removeChild(textNode);

        // Place cursor right after the zero-width space
        const newRange = document.createRange();
        newRange.setStart(afterNode, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        return true;
    };

    // ***bold+italic*** - must be before ** and *
    if (beforeCursor.endsWith('***')) {
        if (replaceInlinePattern(/\*\*\*((?:[^*]|\*(?!\*\*))+)\*\*\*$/, 'strong', 'em')) {
            e.preventDefault();
            return true;
        }
    }

    // **bold**
    if (beforeCursor.endsWith('**')) {
        if (replaceInlinePattern(/\*\*((?:[^*]|\*(?!\*))+)\*\*$/, 'strong')) {
            e.preventDefault();
            return true;
        }
    }

    // *italic*
    if (beforeCursor.endsWith('*')) {
        if (replaceInlinePattern(/\*((?:[^*])+)\*$/, 'em')) {
            e.preventDefault();
            return true;
        }
    }

    // ~~strikethrough~~
    if (beforeCursor.endsWith('~~')) {
        if (replaceInlinePattern(/~~((?:[^~]|~(?!~))+)~~$/, 's')) {
            e.preventDefault();
            return true;
        }
    }

    // `inline code`
    if (beforeCursor.endsWith('`')) {
        if (replaceInlinePattern(/`([^`]+)`$/, 'code')) {
            e.preventDefault();
            return true;
        }
    }

    return false;
};

/**
 * Process markdown patterns in a line (Simplified + Slash Commands)
 * @param {KeyboardEvent} e - Event
 * @param {string} beforeCursor - Text before cursor
 * @param {HTMLElement} blockElement - Block element
 * @param {Selection} selection - Window selection
 * @param {boolean} isFirstLine - Is first line flag
 * @returns {boolean} Whether pattern was matched
 */
export const processMarkdownInLine = (e, beforeCursor, blockElement, selection, isFirstLine = false) => {
    // /h1, /h2, /h3, /h4 - Headers
    const slashHeaderMatch = beforeCursor.match(/^\/(h[1-4])\s*$/);
    if (slashHeaderMatch) {
        e.preventDefault();

        const level = slashHeaderMatch[1].charAt(1);
        const heading = document.createElement(`h${level}`);
        const contentAfter = blockElement.textContent.replace(/^\/h[1-4]\s*/, '').trim();

        if (contentAfter) {
            heading.textContent = contentAfter;
        } else {
            heading.innerHTML = '<br>';
        }

        if (isFirstLine) {
            blockElement.innerHTML = '';
            blockElement.appendChild(heading);
        } else {
            blockElement.replaceWith(heading);
        }

        setCursorAtEnd(heading, selection);
        return true;
    }

    // /quote - Blockquote
    if (beforeCursor.match(/^\/quote\s*$/)) {
        e.preventDefault();
        const quote = document.createElement('blockquote');
        const contentAfter = blockElement.textContent.replace(/^\/quote\s*/, '').trim();

        if (contentAfter) {
            quote.textContent = contentAfter;
        } else {
            quote.innerHTML = '<br>';
        }

        if (isFirstLine) {
            blockElement.innerHTML = '';
            blockElement.appendChild(quote);
        } else {
            blockElement.replaceWith(quote);
        }

        setCursorAtEnd(quote, selection);
        return true;
    }

    // > - Blockquote (Markdown style formatting)
    if (beforeCursor.endsWith('> ') || beforeCursor.endsWith('>\t')) {
        e.preventDefault();

        let beforeBlockquote = beforeCursor.replace(/>\s*$/, '').trim();

        if (beforeBlockquote) {
            const quote = document.createElement('blockquote');
            quote.innerHTML = '<br>';

            blockElement.textContent = beforeBlockquote;
            blockElement.after(quote);

            setCursorAtEnd(quote, selection);
            return true;
        }

        const quote = document.createElement('blockquote');
        const existingHTML = (blockElement && blockElement.innerHTML)
            ? blockElement.innerHTML.replace(/>\s*/, '').trim()
            : '';

        if (existingHTML) {
            const frag = document.createDocumentFragment();
            while (blockElement.firstChild) {
                frag.appendChild(blockElement.firstChild);
            }
            quote.appendChild(frag);
        } else {
            quote.innerHTML = '<br>';
        }

        if (isFirstLine) {
            blockElement.innerHTML = '';
            blockElement.appendChild(quote);
        } else {
            blockElement.replaceWith(quote);
        }

        setCursorAtEnd(quote, selection);
        return true;
    }

    // /code - Code Block
    if (beforeCursor.match(/^\/code(?:\s+(.*))?$/)) {
        e.preventDefault();
        const contentAfter = RegExp.$1 || '';

        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = contentAfter || '\n';
        pre.appendChild(code);

        if (isFirstLine) {
            blockElement.innerHTML = '';
            blockElement.appendChild(pre);
        } else {
            blockElement.replaceWith(pre);
        }

        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(code);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);

        return true;
    }

    // /check - Task List
    if (beforeCursor.match(/^\/check\s*$/)) {
        e.preventDefault();
        const ul = document.createElement('ul');
        ul.style.listStyleType = 'none';
        ul.style.paddingLeft = '0';

        const li = document.createElement('li');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = false;
        checkbox.style.marginRight = '8px';

        const contentAfter = blockElement.textContent.replace(/^\/check\s*/, '').trim();
        const textSpan = document.createElement('span');
        textSpan.dataset.editorKeep = '1';
        textSpan.textContent = contentAfter || '';
        textSpan.contentEditable = 'true';

        li.appendChild(checkbox);
        li.appendChild(textSpan);
        ul.appendChild(li);

        if (isFirstLine) {
            blockElement.innerHTML = '';
            blockElement.appendChild(ul);
        } else {
            blockElement.replaceWith(ul);
        }

        setCursorAtEnd(textSpan, selection);
        return true;
    }

    // /hr or /line - Horizontal Rule
    if (beforeCursor.match(/^\/(hr|line)\s*$/)) {
        e.preventDefault();
        const hr = document.createElement('hr');
        const newP = document.createElement('p');
        newP.innerHTML = '<br>';

        if (isFirstLine) {
            blockElement.innerHTML = '';
            blockElement.appendChild(hr);
            blockElement.appendChild(newP);
        } else {
            blockElement.replaceWith(hr);
            hr.after(newP);
        }

        setCursorAtEnd(newP, selection);
        return true;
    }

    // /table - Create a 2x2 Table
    if (beforeCursor.match(/^\/table\s*$/)) {
        e.preventDefault();

        const table = document.createElement('table');
        table.className = 'fascinate-notes-table';
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        const trHead = document.createElement('tr');
        const trBody = document.createElement('tr');

        const th1 = document.createElement('th');
        th1.innerHTML = '<br>';
        const th2 = document.createElement('th');
        th2.innerHTML = '<br>';

        const td1 = document.createElement('td');
        td1.innerHTML = '<br>';
        const td2 = document.createElement('td');
        td2.innerHTML = '<br>';

        trHead.appendChild(th1);
        trHead.appendChild(th2);
        thead.appendChild(trHead);

        trBody.appendChild(td1);
        trBody.appendChild(td2);
        tbody.appendChild(trBody);

        table.appendChild(thead);
        table.appendChild(tbody);

        if (isFirstLine) {
            blockElement.innerHTML = '';
            blockElement.appendChild(table);
        } else {
            blockElement.replaceWith(table);
        }

        setCursorAtEnd(th1, selection);
        return true;
    }

    // Headers: # ## ### ####
    const headerMatch = beforeCursor.match(/^(#{1,4})\s*$/);
    if (headerMatch) {
        e.preventDefault();
        const level = headerMatch[1].length;
        const heading = document.createElement(`h${level}`);
        const contentAfterHash = blockElement.textContent.substring(headerMatch[0].length).trim();

        if (contentAfterHash) {
            heading.textContent = contentAfterHash;
        } else {
            heading.innerHTML = '<br>';
        }

        if (isFirstLine) {
            blockElement.innerHTML = '';
            blockElement.appendChild(heading);
        } else {
            blockElement.replaceWith(heading);
        }

        setCursorAtEnd(heading, selection);
        return true;
    }

    // Unordered List
    if (beforeCursor.match(/^-\s*$/)) {
        e.preventDefault();
        const ul = document.createElement('ul');
        ul.className = 'unordered-list';
        const li = document.createElement('li');
        const contentAfterMarker = blockElement.textContent.substring(1).trim();

        if (contentAfterMarker) {
            li.textContent = contentAfterMarker;
        } else {
            li.innerHTML = '<br>';
        }

        ul.appendChild(li);

        if (isFirstLine) {
            blockElement.innerHTML = '';
            blockElement.appendChild(ul);
        } else {
            blockElement.replaceWith(ul);
        }

        setCursorAtEnd(li, selection);
        return true;
    }

    // Ordered List: 1. 2. 3.
    if (beforeCursor.match(/^\d+\.\s*$/)) {
        e.preventDefault();
        const ol = document.createElement('ol');
        ol.className = 'ordered-list';
        const li = document.createElement('li');
        li.style.listStyle = 'decimal';
        const contentAfterNumber = blockElement.textContent.replace(/^\d+\.\s*/, '').trim();

        if (contentAfterNumber) {
            li.textContent = contentAfterNumber;
        } else {
            li.innerHTML = '<br>';
        }

        ol.appendChild(li);

        if (isFirstLine) {
            blockElement.innerHTML = '';
            blockElement.appendChild(ol);
        } else {
            blockElement.replaceWith(ol);
        }

        setCursorAtEnd(li, selection);
        return true;
    }

    return false;
};
