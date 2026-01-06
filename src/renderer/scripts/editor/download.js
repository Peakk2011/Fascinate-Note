import domtoimage from 'dom-to-image';
import { downloadMarkupsContent } from './downloadStyle/cssConfig.js';

/**
 * Styles for HTML export including theme colors
 * @param {HTMLElement} editor - Editor element
 * @returns {Object} Style object
 */

const getEditorStyles = (editor) => {
    const styles = window.getComputedStyle(editor);
    const rootStyles = window.getComputedStyle(document.documentElement);

    // Store theme color from CSS variables
    const themeFg = rootStyles.getPropertyValue(
        '--theme-fg'
    ).trim() || styles.color;

    const themeBg = rootStyles.getPropertyValue(
        '--theme-bg'
    ).trim() || styles.backgroundColor;

    const themeAccent = rootStyles.getPropertyValue(
        '--theme-accent'
    ).trim() || '';

    return {
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        lineHeight: styles.lineHeight,
        color: themeFg,
        backgroundColor: themeBg,
        themeAccent: themeAccent
    }
};

/**
 * Export editor content as HTML
 * @param {HTMLElement} editor - Editor element
 * @param {boolean} includeStyles - Include inline styles
 * @returns {string} HTML string
 */

export const exportHTML = (editor, includeStyles = true) => {
    let html = editor.innerHTML;

    if (includeStyles) {
        const styles = getEditorStyles(editor);
        const styleString = `
            font-size: ${styles.fontSize}; 
            line-height: ${styles.lineHeight}; 
            color: ${styles.color}; 
            background-color: ${styles.backgroundColor};
            padding: 1rem;
        `;
        html = `<div style="${styleString}">${html}</div>`;
    }

    return html;
}

/**
 * Download as HTML file with proper theme styling
 * @param {HTMLElement} editor - Editor element
 * @param {string} filename - Output filename
 */

export const downloadHTML = (editor, filename = 'document.html') => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documents</title>
    <style>${downloadMarkupsContent.styles}</style>
</head>
<body>
${editor.innerHTML}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

}

/**
 * Download as TXT file
 * @param {HTMLElement} editor - Editor element
 * @param {string} filename - Output filename
 */

export const downloadTXT = (editor, filename = 'document.txt') => {
    const text = editor.innerText;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Get effective background color of an element
 * @param {HTMLElement} element - The starting element
 * @returns {string} The effective background color in CSS format
 */
const getBackgroundColor = (element) => {
    let el = element;

    while (el && el !== document.documentElement) {
        const bgColor = window.getComputedStyle(el).backgroundColor;

        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            return bgColor;
        }

        el = el.parentElement;
    }

    const rootBgColor = window.getComputedStyle(document.documentElement).backgroundColor;
    if (rootBgColor && rootBgColor !== 'rgba(0, 0, 0, 0)' && rootBgColor !== 'transparent') {
        return rootBgColor;
    }

    return '#FFFFFF';
};

/**
 * Download element as PNG image
 * @param {HTMLElement} editor - The element to capture
 * @param {string} filename - Output filename (default: 'document.png')
 * @returns {Promise<void>}
 */
export const downloadImage = async (editor, filename = 'document.png') => {
    if (!editor) {
        throw new Error('Editor element is required');
    }

    const backgroundColor = getBackgroundColor(editor);
    const dpr = window.devicePixelRatio || 1;
    const scale = dpr * 2;

    const width = editor.offsetWidth;
    const height = editor.offsetHeight;

    const originalOverflow = editor.style.overflow;
    editor.style.overflow = 'hidden';

    try {
        const dataUrl = await domtoimage.toPng(editor, {
            bgcolor: backgroundColor,
            width: width * scale,
            height: height * scale,
            style: {
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: `${width}px`,
                height: `${height}px`,
            },
        });

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } catch (error) {
        console.error('Failed to generate image:', error);
        throw error; // Re-throw เพื่อให้ caller จัดการต่อได้
    } finally {
        editor.style.overflow = originalOverflow;
    }
};