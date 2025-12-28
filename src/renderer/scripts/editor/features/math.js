/**
 * Math expression suggestion system
 * @module math
 */

/** Debounce delay for math evaluation (ms) */
const MATH_EVAL_DELAY = 150;

// Utility Functions

/**
 * Evaluates a mathematical expression safely
 * @param {string} expr - Expression to evaluate
 * @returns {number|null} Result or null if invalid
 */
const evaluateMath = (expr) => {
    const safe = expr.replace(/\^/g, '**');
    
    // Whitelist check for safe characters
    if (!/^[0-9+\-*/%().,\sA-Za-z*_]+$/.test(safe)) {
        return null;
    }

    const mathFunctions = {
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        sqrt: Math.sqrt,
        log: Math.log,
        ln: Math.log,
        abs: Math.abs,
        pow: Math.pow,
        max: Math.max,
        min: Math.min,
        round: Math.round,
        floor: Math.floor,
        ceil: Math.ceil,
        PI: Math.PI,
        E: Math.E
    };

    try {
        const fn = new Function('fns', `with(fns){ return (${safe}); }`);
        const value = fn(mathFunctions);
        return typeof value === 'number' && isFinite(value) ? value : null;
    } catch {
        return null;
    }
};

/**
 * Gets text content before cursor position
 * @param {Range} range - Selection range
 * @returns {string}
 */
const getTextBeforeCursor = (range) => {
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
        return range.startContainer.textContent.slice(0, range.startOffset);
    }
    return '';
};

// Math System Controller

/**
 * Initializes math suggestion system for an editor
 * @param {HTMLElement} editor - The contenteditable element
 * @param {Function} positionTooltipAtRange - Function to position tooltip
 * @returns {{destroy: Function}} Controller object with destroy method
 */
export const initMathSystem = (editor, positionTooltipAtRange) => {
    /** Timer for debounced math evaluation */
    let mathEvalTimer = null;
    
    /** Current math suggestion state */
    let currentSuggestion = null;
    
    /** Math tooltip element */
    const mathTooltip = document.createElement('div');
    mathTooltip.className = 'math-suggestion-tooltip';
    mathTooltip.style.position = 'fixed';
    mathTooltip.style.zIndex = '2000';
    mathTooltip.style.display = 'none';
    document.body.appendChild(mathTooltip);

    // Math Evaluation Functions

    /**
     * Handles math expression suggestions
     */
    const handleMathSuggestion = () => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) {
            hideMathTooltip();
            return;
        }

        const range = selection.getRangeAt(0);
        const textBefore = getTextBeforeCursor(range);

        if (!textBefore) {
            hideMathTooltip();
            return;
        }

        // Match potential math expressions (up to 80 chars)
        const exprMatch = textBefore.match(/([0-9A-Za-z_\)\(\+\-\*\/\.%,\s]{1,80})$/);
        
        if (exprMatch) {
            const expr = exprMatch[1].trim();
            const result = evaluateMath(expr);

            if (result !== null) {
                showMathSuggestion(result, range);
            } else {
                hideMathTooltip();
            }
        } else {
            hideMathTooltip();
        }
    };

    /**
     * Shows math suggestion tooltip
     * @param {number} value - Calculated value
     * @param {Range} range - Text range
     */
    const showMathSuggestion = (value, range) => {
        currentSuggestion = {
            value,
            range: range.cloneRange()
        };

        mathTooltip.textContent = String(value);
        mathTooltip.style.display = 'block';
        positionTooltipAtRange(mathTooltip, range);
    };

    /**
     * Hides math suggestion tooltip
     */
    const hideMathTooltip = () => {
        currentSuggestion = null;
        mathTooltip.style.display = 'none';
    };

    /**
     * Inserts math suggestion into editor
     */
    const insertMathSuggestion = () => {
        if (!currentSuggestion) return;

        try {
            const { value, range } = currentSuggestion;
            range.deleteContents();
            range.insertNode(document.createTextNode(String(value)));
            
            // Move cursor after inserted text
            range.collapse(false);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (error) {
            // Fallback to execCommand for older browsers
            document.execCommand('insertText', false, String(currentSuggestion.value));
        }

        hideMathTooltip();
    };

    /**
     * Schedules math evaluation with debouncing
     */
    const scheduleMathEval = () => {
        if (mathEvalTimer) {
            clearTimeout(mathEvalTimer);
        }
        mathEvalTimer = setTimeout(handleMathSuggestion, MATH_EVAL_DELAY);
    };

    // Event Handlers

    /**
     * Handles input events for math evaluation
     */
    const handleInputForMath = () => {
        scheduleMathEval();
    };

    /**
     * Handles keydown events for math suggestions
     * @param {KeyboardEvent} event
     */
    const handleKeyDownForMath = (event) => {
        // Insert math suggestion on Enter or Tab
        if ((event.key === 'Enter' || event.key === 'Tab') && currentSuggestion) {
            event.preventDefault();
            insertMathSuggestion();
        }
    };

    // Event Listener Registration
    editor.addEventListener('input', handleInputForMath);
    editor.addEventListener('keydown', handleKeyDownForMath);

    // Public API

    /**
     * Cleanup function to remove math system
     */
    const destroy = () => {
        // Remove event listeners
        editor.removeEventListener('input', handleInputForMath);
        editor.removeEventListener('keydown', handleKeyDownForMath);

        // Clear timer
        if (mathEvalTimer) {
            clearTimeout(mathEvalTimer);
        }

        // Remove tooltip
        mathTooltip.remove();

        // Clear suggestion state
        currentSuggestion = null;

        console.log('Math system destroyed');
    };

    return { destroy };
};

export default initMathSystem;