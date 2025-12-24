/**
 * @typedef {object} ExportMenuConfig
 * @property {string} exportHtmlButtonId                    - ID for the main export button.
 * @property {string} exportHtmlButtonTitle                 - Title attribute for the main export button.
 * @property {string} exportHtmlButtonText                  - Text content for the main export button.
 * @property {string} exportMenuId                          - ID for the export menu dropdown container.
 * @property {string} exportMenuHtmlText                    - Text for the "Export HTML" option.
 * @property {string} exportMenuTxtText                     - Text for the "Export TXT" option.
 * @property {string} exportMenuImageText                   - Text for the "Export Image" option.
 */

/**
 * @typedef {object} RichEditorAPI
 * @property {(filename: string) => void} downloadHTML      - Triggers download of editor content as HTML.
 * @property {(filename: string) => void} downloadTXT       - Triggers download of editor content as plain text.
 * @property {(filename: string) => void} downloadImage     - Triggers download of editor content as an image.
 */

/**
 * @typedef {object} ExportMenuAPI
 * @property {() => void} cleanup                           - Removes all event listeners to prevent memory leaks.
 */

/**
 * Generates the HTML markup for the export menu component.
 * @param {ExportMenuConfig} config - Configuration object for the export menu.
 * @returns {string} The HTML string representing the export menu.
 */
export const createExportMenuMarkup = (config) => {
    return `
        <div class="export-container">
            <button id="${config.exportHtmlButtonId}" title="${config.exportHtmlButtonTitle}">
                <span>${config.exportHtmlButtonText}</span>
            </button>
            <div id="${config.exportMenuId}" class="export-menu">
                <button id="export-html">${config.exportMenuHtmlText}</button>
                <button id="export-txt">${config.exportMenuTxtText}</button>
                <button id="export-image">${config.exportMenuImageText}</button>
            </div>
        </div>
    `;
}

/**
 * Initializes the functionality for the export menu.
 * @param {ExportMenuConfig} config                         - Configuration object containing IDs for the elements.
 * @param {RichEditorAPI} richEditor                        - API for interacting with the rich text editor.
 * @returns {ExportMenuAPI} An object containing a `cleanup` function.
 */
export const initExportMenu = (config, richEditor) => {
    const exportBtn = document.getElementById(config.exportHtmlButtonId);
    const exportMenu = document.getElementById(config.exportMenuId);
    const exportHtmlBtn = document.getElementById('export-html');
    const exportTxtBtn = document.getElementById('export-txt');
    const exportImageBtn = document.getElementById('export-image');

    if (!exportBtn || !exportMenu || !richEditor) {
        console.warn(
            '[ExportMenu] Initialization failed: required elements or API not found.'
        );
        return { cleanup: () => { } };
    }

    let isMenuVisible = false;
    let transitionFallbackTimer = null;

    /**
     * Generates a filename with the current date.
     * @param {'html' | 'txt' | 'png'} extension - The file extension.
     * @returns {string} The generated filename.
     */
    const generateFilename = (extension) => {
        const date = new Date().toISOString().slice(0, 10);
        return `note-${date}.${extension}`;
    };

    const showMenu = () => {
        if (isMenuVisible) return;
        isMenuVisible = true;

        clearTimeout(transitionFallbackTimer);
        exportMenu.style.display = 'block';
        
        requestAnimationFrame(() => {
            exportMenu.classList.add('show');
        });
    };

    const hideMenu = () => {
        if (!isMenuVisible) return;
        isMenuVisible = false;

        exportMenu.classList.remove('show');

        const onTransitionEnd = () => {
            clearTimeout(transitionFallbackTimer);
            exportMenu.style.display = 'none';
        };

        exportMenu.addEventListener(
            'transitionend',
            onTransitionEnd,
            {
                once: true
            }
        );

        // Fallback in case transitionend event doesn't fire
        transitionFallbackTimer = setTimeout(onTransitionEnd, 300);
    };

    /** @param {Event} event */
    const handleToggle = (event) => {
        event.stopPropagation();
        isMenuVisible ? hideMenu() : showMenu();
    };

    const handleExportHtml = () => {
        richEditor.downloadHTML(generateFilename('html'));
        hideMenu();
    };

    const handleExportTxt = () => {
        richEditor.downloadTXT(generateFilename('txt'));
        hideMenu();
    };
    
    const handleExportImage = () => {
        richEditor.downloadImage(generateFilename('png'));
        hideMenu();
    };

    /** @param {MouseEvent} event */
    const handleClickOutside = (event) => {
        if (isMenuVisible &&
            !exportBtn.contains(event.target) &&
            !exportMenu.contains(event.target)) {
            hideMenu();
        }
    };

    exportBtn.addEventListener(
        'click',
        handleToggle
    );

    exportHtmlBtn.addEventListener(
        'click',
        handleExportHtml
    );
    
    exportTxtBtn.addEventListener(
        'click',
        handleExportTxt
    );

    exportImageBtn.addEventListener(
        'click',
        handleExportImage
    );

    document.addEventListener(
        'click',
        handleClickOutside
    );

    return {
        cleanup() {
            exportBtn.removeEventListener('click', handleToggle);
            exportHtmlBtn.removeEventListener('click', handleExportHtml);
            exportTxtBtn.removeEventListener('click', handleExportTxt);
            exportImageBtn.removeEventListener('click', handleExportImage);
            document.removeEventListener('click', handleClickOutside);
            clearTimeout(transitionFallbackTimer);
        }
    };
};
