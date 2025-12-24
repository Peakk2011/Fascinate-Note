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
 * Download as Image file
 * @param {HTMLElement} editor - Editor element
 * @param {string} filename - Output filename
 */
export const downloadImage = (editor, filename = 'document.png') => {
    const rect = editor.getBoundingClientRect();
    const styles = getEditorStyles(editor);

    const data = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
            <foreignObject width="100%" height="100%">
                <div xmlns="http://www.w3.org/1999/xhtml">
                    <style>
                        ${downloadMarkupsContent.styles}
                        body {
                            color: ${styles.color};
                            background-color: ${styles.backgroundColor};
                        }
                    </style>
                    ${editor.innerHTML}
                </div>
            </foreignObject>
        </svg>`;

    const img = new Image();
    const svg = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svg);

    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = styles.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    };

    img.src = url;
};