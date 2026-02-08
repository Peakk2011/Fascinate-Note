/**
 * Text editor rendering module with URL preview cards and math suggestions
 * @module rendering
 */

import { initMathSystem } from './features/math.js';
import { initURLPreviewSystem } from './features/urlPreview.js';
import { initContentBlocks } from './features/contentBlocks.js';

// Utility Functions

/**
 * Sanitizes text by escaping HTML special characters
 * @param {string} str - Text to sanitize
 * @returns {string} Sanitized text
 */
const sanitizeText = (str) => {
    return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const RENDERING_LIMITS = {
    urlPreviewDisableAt: 50000,
    urlPreviewEnableAt: 45000,
    mathDisableAt: 50000,
    mathEnableAt: 45000,
    blocksEnableAt: 50000,
    sizeCheckDebounce: 300,
    fullCountDebounce: 1200
};

const PERFORMANCE_MODE_KEY = 'fascin-performance-mode';

/**
 * Positions a tooltip element at a given range
 * @param {HTMLElement} tooltip - Tooltip element
 * @param {Range} range - Text range to position at
 */
const positionTooltipAtRange = (tooltip, range) => {
    try {
        const rect = range.getBoundingClientRect();
        const viewport = window.visualViewport || {
            width: window.innerWidth,
            height: window.innerHeight,
            offsetLeft: 0,
            offsetTop: 0
        };

        let left = rect.left + rect.width / 2 + (viewport.offsetLeft || 0);
        let top = rect.top + rect.height + (viewport.offsetTop || 0) + 8;

        // Flip tooltip above if it would go off screen
        if (top + tooltip.offsetHeight > viewport.height + (viewport.offsetTop || 0)) {
            top = rect.top - tooltip.offsetHeight - 8 + (viewport.offsetTop || 0);
        }

        tooltip.style.left = `${Math.max(8, left - tooltip.offsetWidth / 2)}px`;
        tooltip.style.top = `${Math.max(8, top)}px`;
    } catch (error) {
        console.error('Error positioning tooltip:', error);
    }
};

// Main Rendering Controller

/**
 * Initializes rendering enhancements for a contenteditable element
 * @param {HTMLElement} editor - The contenteditable element to enhance
 * @returns {{destroy: Function}} Controller object with destroy method
 */
export const initRendering = (editor) => {
    if (!editor) {
        console.warn('initRendering: No editor element provided');
        return { destroy: () => {} };
    }
    
    let mathSystem = null;
    let urlPreviewSystem = null;
    let mathEnabled = true;
    let urlPreviewEnabled = true;
    let performanceMode = false;
    let docLength = 0;
    let lengthDirty = false;
    let fullCountTimer = null;

    const contentBlocks = initContentBlocks(editor, {
        threshold: RENDERING_LIMITS.blocksEnableAt
    });

    const enableMath = () => {
        if (!mathSystem) {
            mathSystem = initMathSystem(editor, positionTooltipAtRange);
            return;
        }
        mathSystem.setEnabled(true);
    };

    const disableMath = () => {
        if (mathSystem) {
            mathSystem.setEnabled(false);
        }
    };

    const enableUrlPreview = () => {
        if (!urlPreviewSystem) {
            urlPreviewSystem = initURLPreviewSystem(editor, sanitizeText);
            return;
        }
        urlPreviewSystem.setEnabled(true);
    };

    const disableUrlPreview = () => {
        if (urlPreviewSystem) {
            urlPreviewSystem.setEnabled(false);
        }
    };

    let sizeCheckTimer = null;

    const getDocumentLength = () => (editor.textContent || '').length;

    const setDocLength = (next) => {
        docLength = Math.max(0, Number(next) || 0);
        editor.dataset.docLength = String(docLength);
    };

    const updatePerformanceDataset = () => {
        editor.dataset.performanceMode = performanceMode ? '1' : '0';
    };

    const loadPerformanceMode = () => {
        try {
            performanceMode = localStorage.getItem(PERFORMANCE_MODE_KEY) === '1';
        } catch (error) {
            performanceMode = false;
        }
        updatePerformanceDataset();
    };

    const updateFeatureStates = (length) => {
        if ((performanceMode || length >= RENDERING_LIMITS.urlPreviewDisableAt) && urlPreviewEnabled) {
            urlPreviewEnabled = false;
            disableUrlPreview();
        } else if (!performanceMode && length <= RENDERING_LIMITS.urlPreviewEnableAt && !urlPreviewEnabled) {
            urlPreviewEnabled = true;
            enableUrlPreview();
        }

        if ((performanceMode || length >= RENDERING_LIMITS.mathDisableAt) && mathEnabled) {
            mathEnabled = false;
            disableMath();
        } else if (!performanceMode && length <= RENDERING_LIMITS.mathEnableAt && !mathEnabled) {
            mathEnabled = true;
            enableMath();
        }

        if (urlPreviewEnabled && !urlPreviewSystem) {
            enableUrlPreview();
        }

        if (mathEnabled && !mathSystem) {
            enableMath();
        }

        contentBlocks.update(length);
    };

    const recomputeDocLength = () => {
        lengthDirty = false;
        setDocLength(getDocumentLength());
        updateFeatureStates(docLength);
    };

    const scheduleFullCount = () => {
        if (fullCountTimer) return;

        fullCountTimer = setTimeout(() => {
            fullCountTimer = null;
            const run = () => {
                recomputeDocLength();
            };

            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(run, { timeout: 1200 });
            } else {
                run();
            }
        }, RENDERING_LIMITS.fullCountDebounce);
    };

    const applyLengthDelta = (delta) => {
        setDocLength(docLength + delta);
    };

    const updateDocLengthFromInput = (event) => {
        if (!event || !event.inputType) {
            lengthDirty = true;
            scheduleFullCount();
            return;
        }

        const dataLength = event.data ? event.data.length : 0;
        let delta = null;

        switch (event.inputType) {
            case 'insertText':
            case 'insertCompositionText':
                delta = dataLength;
                break;
            case 'insertLineBreak':
            case 'insertParagraph':
                delta = 1;
                break;
            case 'insertFromPaste':
            case 'insertFromDrop':
            case 'insertReplacementText':
                delta = dataLength > 0 ? dataLength : null;
                break;
            case 'deleteContentBackward':
            case 'deleteContentForward':
            case 'deleteByCut':
            case 'deleteByDrag':
            case 'deleteContent':
            case 'deleteWordBackward':
            case 'deleteWordForward':
            case 'deleteSoftLineBackward':
            case 'deleteSoftLineForward':
            case 'deleteHardLineBackward':
            case 'deleteHardLineForward':
            case 'deleteEntireSoftLine':
            case 'deleteByLine':
            case 'historyUndo':
            case 'historyRedo':
                delta = null;
                break;
            default:
                delta = null;
                break;
        }

        if (typeof delta === 'number') {
            applyLengthDelta(delta);
        } else {
            lengthDirty = true;
            scheduleFullCount();
        }
    };

    const scheduleSizeCheck = () => {
        if (sizeCheckTimer) {
            clearTimeout(sizeCheckTimer);
        }

        sizeCheckTimer = setTimeout(() => {
            updateFeatureStates(docLength);
        }, RENDERING_LIMITS.sizeCheckDebounce);
    };

    const handleContentChange = (event) => {
        if (event?.type === 'input') {
            updateDocLengthFromInput(event);
        } else {
            lengthDirty = true;
            scheduleFullCount();
        }
        scheduleSizeCheck();
    };

    editor.addEventListener('input', handleContentChange);
    editor.addEventListener('paste', handleContentChange);
    editor.addEventListener('cut', handleContentChange);

    loadPerformanceMode();
    setDocLength(getDocumentLength());
    updateFeatureStates(docLength);

    const setPerformanceMode = (next) => {
        performanceMode = Boolean(next);
        updatePerformanceDataset();

        try {
            localStorage.setItem(
                PERFORMANCE_MODE_KEY,
                performanceMode ? '1' : '0'
            );
        } catch (error) {
            // Ignore storage errors.
        }

        updateFeatureStates(docLength);
    };

    const getPerformanceMode = () => performanceMode;

    // Public API

    /**
     * Cleanup function to remove all enhancements
     */
    const destroy = () => {
        editor.removeEventListener('input', handleContentChange);
        editor.removeEventListener('paste', handleContentChange);
        editor.removeEventListener('cut', handleContentChange);

        if (sizeCheckTimer) {
            clearTimeout(sizeCheckTimer);
            sizeCheckTimer = null;
        }

        if (fullCountTimer) {
            clearTimeout(fullCountTimer);
            fullCountTimer = null;
        }

        // Destroy subsystems
        if (mathSystem) {
            mathSystem.destroy();
        }

        if (urlPreviewSystem) {
            urlPreviewSystem.destroy();
        }

        contentBlocks.destroy();

        console.log('Rendering enhancements destroyed');
    };

    return {
        destroy,
        setPerformanceMode,
        getPerformanceMode
    };
};

export default initRendering;