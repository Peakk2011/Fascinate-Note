/**
 * Math expression suggestion system
 * @module math
 */

import { getTextBeforeCursor } from '../nodeElement.js';

const DEFAULT_MATH_CONFIG = {
    evalDelay: 150,
    maxExprLength: 80,
    maxResultDecimals: 6
};

const FUNCTION_DEFS = {
    sin: { arity: 1, fn: (args) => Math.sin(args[0]) },
    cos: { arity: 1, fn: (args) => Math.cos(args[0]) },
    tan: { arity: 1, fn: (args) => Math.tan(args[0]) },
    sqrt: { arity: 1, fn: (args) => Math.sqrt(args[0]) },
    log: { arity: 1, fn: (args) => Math.log(args[0]) },
    ln: { arity: 1, fn: (args) => Math.log(args[0]) },
    abs: { arity: 1, fn: (args) => Math.abs(args[0]) },
    pow: { arity: 2, fn: (args) => Math.pow(args[0], args[1]) },
    max: { minArgs: 1, variadic: true, fn: (args) => Math.max(...args) },
    min: { minArgs: 1, variadic: true, fn: (args) => Math.min(...args) },
    round: { arity: 1, fn: (args) => Math.round(args[0]) },
    floor: { arity: 1, fn: (args) => Math.floor(args[0]) },
    ceil: { arity: 1, fn: (args) => Math.ceil(args[0]) }
};

const CONSTANTS = {
    pi: Math.PI,
    e: Math.E
};

// Utility Functions

/**
 * Evaluates a mathematical expression safely
 * @param {string} expr - Expression to evaluate
 * @returns {number|null} Result or null if invalid
 */
const evaluateMath = (expr) => {
    const tokens = tokenizeMath(expr);
    if (!tokens || tokens.length === 0) return null;

    const rpn = toRpn(tokens);
    if (!rpn) return null;

    return evaluateRpn(rpn);
};

const isLikelyMathExpression = (expr) => {
    if (!expr) return false;

    const hasNumber = /\d/.test(expr);
    if (!hasNumber) return false;

    const hasOperator = /[+\-*/%^]/.test(expr);
    const hasFunction = /\b(sin|cos|tan|sqrt|log|ln|abs|pow|max|min|round|floor|ceil)\s*\(/i.test(expr);
    const hasParens = /[()]/.test(expr);

    return hasOperator || hasFunction || hasParens;
};

const extractCandidateExpression = (text, maxLen) => {
    if (!text) return '';

    const isAllowedChar = (char) =>
        (char >= '0' && char <= '9') ||
        (char >= 'a' && char <= 'z') ||
        (char >= 'A' && char <= 'Z') ||
        char === '+' || char === '-' || char === '*' || char === '/' ||
        char === '%' || char === '^' || char === '(' || char === ')' ||
        char === '.' || char === ',' || /\s/.test(char);

    let endIndex = text.length;
    let startIndex = endIndex;
    while (startIndex > 0 && isAllowedChar(text[startIndex - 1])) {
        startIndex -= 1;
    }

    let candidate = text.slice(startIndex, endIndex);
    if (candidate.length > maxLen) {
        candidate = candidate.slice(candidate.length - maxLen);
    }

    return candidate.trim();
};

const formatMathResult = (value, maxDecimals) => {
    if (!isFinite(value)) return null;
    if (Number.isInteger(value)) return String(value);

    const abs = Math.abs(value);
    if (abs !== 0 && (abs < 1e-6 || abs >= 1e12)) {
        return value.toExponential(Math.min(6, maxDecimals));
    }

    const fixed = value.toFixed(maxDecimals);
    return fixed.replace(/\.?0+$/, '');
};

const tokenizeMath = (expr) => {
    const tokens = [];
    const length = expr.length;
    let index = 0;
    let prevType = 'start';

    const isDigit = (char) => char >= '0' && char <= '9';
    const isLetter = (char) => (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');

    const peekNextNonSpace = (startIndex) => {
        let scanIndex = startIndex;
        while (scanIndex < length && /\s/.test(expr[scanIndex])) scanIndex += 1;
        return expr[scanIndex] || '';
    };

    while (index < length) {
        const char = expr[index];

        if (/\s/.test(char)) {
            index += 1;
            continue;
        }

        if (isDigit(char) || (char === '.' && isDigit(expr[index + 1]))) {
            const match = expr.slice(index).match(/^(\d+(\.\d*)?|\.\d+)([eE][+\-]?\d+)?/);
            if (!match) return null;
            const raw = match[0];
            const value = Number(raw);
            if (!isFinite(value)) return null;
            tokens.push({ type: 'number', value });
            index += raw.length;
            prevType = 'number';
            continue;
        }

        if (isLetter(char)) {
            const startIndex = index;
            while (index < length && isLetter(expr[index])) index += 1;
            const ident = expr.slice(startIndex, index).toLowerCase();
            const nextNonSpace = peekNextNonSpace(index);

            if (FUNCTION_DEFS[ident] && nextNonSpace === '(') {
                tokens.push({ type: 'function', value: ident });
                prevType = 'function';
                continue;
            }

            if (Object.prototype.hasOwnProperty.call(CONSTANTS, ident)) {
                tokens.push({ type: 'number', value: CONSTANTS[ident] });
                prevType = 'number';
                continue;
            }

            return null;
        }

        if (char === '(') {
            tokens.push({ type: 'lparen' });
            index += 1;
            prevType = 'lparen';
            continue;
        }

        if (char === ')') {
            tokens.push({ type: 'rparen' });
            index += 1;
            prevType = 'rparen';
            continue;
        }

        if (char === ',') {
            tokens.push({ type: 'comma' });
            index += 1;
            prevType = 'comma';
            continue;
        }

        if ('+-*/%^'.includes(char)) {
            let op = char;
            const unaryContext = prevType === 'start' || prevType === 'operator' ||
                prevType === 'lparen' || prevType === 'comma' || prevType === 'function';

            if (unaryContext && (char === '+' || char === '-')) {
                op = char === '-' ? 'u-' : 'u+';
            }

            tokens.push({ type: 'operator', value: op });
            index += 1;
            prevType = 'operator';
            continue;
        }

        return null;
    }

    return tokens;
};

const toRpn = (tokens) => {
    const output = [];
    const ops = [];
    const argCountStack = [];
    const argHasValueStack = [];
    let prevType = 'start';

    const precedence = {
        '^': 4,
        'u+': 3,
        'u-': 3,
        '*': 2,
        '/': 2,
        '%': 2,
        '+': 1,
        '-': 1
    };

    const rightAssociative = new Set(['^', 'u+', 'u-']);

    const markArgHasValue = () => {
        if (argHasValueStack.length > 0) {
            argHasValueStack[argHasValueStack.length - 1] = true;
        }
    };

    for (const token of tokens) {
        if (token.type === 'number') {
            output.push(token);
            markArgHasValue();
            prevType = 'number';
            continue;
        }

        if (token.type === 'function') {
            ops.push(token);
            prevType = 'function';
            continue;
        }

        if (token.type === 'operator') {
            while (ops.length > 0) {
                const top = ops[ops.length - 1];
                if (top.type !== 'operator') break;

                const precTop = precedence[top.value] || 0;
                const precCurrent = precedence[token.value] || 0;
                const isRight = rightAssociative.has(token.value);

                if (precTop > precCurrent || (precTop === precCurrent && !isRight)) {
                    output.push(ops.pop());
                } else {
                    break;
                }
            }
            ops.push(token);
            prevType = 'operator';
            continue;
        }

        if (token.type === 'lparen') {
            ops.push(token);
            if (prevType === 'function') {
                argCountStack.push(0);
                argHasValueStack.push(false);
            }
            prevType = 'lparen';
            continue;
        }

        if (token.type === 'comma') {
            while (ops.length > 0 && ops[ops.length - 1].type !== 'lparen') {
                output.push(ops.pop());
            }

            if (argHasValueStack.length === 0) return null;
            if (!argHasValueStack[argHasValueStack.length - 1]) return null;

            argCountStack[argCountStack.length - 1] += 1;
            argHasValueStack[argHasValueStack.length - 1] = false;
            prevType = 'comma';
            continue;
        }

        if (token.type === 'rparen') {
            while (ops.length > 0 && ops[ops.length - 1].type !== 'lparen') {
                output.push(ops.pop());
            }

            if (ops.length === 0) return null;
            ops.pop();

            if (ops.length > 0 && ops[ops.length - 1].type === 'function') {
                const func = ops.pop();
                let argCount = 0;
                if (argCountStack.length > 0) {
                    argCount = argCountStack.pop();
                    const hadValue = argHasValueStack.pop();
                    if (hadValue) argCount += 1;
                }

                if (argCount === 0) return null;
                output.push({ type: 'function', value: func.value, argCount });
            }

            markArgHasValue();
            prevType = 'rparen';
        }
    }

    while (ops.length > 0) {
        const token = ops.pop();
        if (token.type === 'lparen' || token.type === 'rparen') return null;
        output.push(token);
    }

    return output;
};

const evaluateRpn = (tokens) => {
    const stack = [];

    for (const token of tokens) {
        if (token.type === 'number') {
            stack.push(token.value);
            continue;
        }

        if (token.type === 'operator') {
            if (token.value === 'u+' || token.value === 'u-') {
                if (stack.length < 1) return null;
                const value = stack.pop();
                stack.push(token.value === 'u-' ? -value : value);
                continue;
            }

            if (stack.length < 2) return null;
            const right = stack.pop();
            const left = stack.pop();
            let result = null;

            switch (token.value) {
                case '+':
                    result = left + right;
                    break;
                case '-':
                    result = left - right;
                    break;
                case '*':
                    result = left * right;
                    break;
                case '/':
                    result = right === 0 ? null : left / right;
                    break;
                case '%':
                    result = right === 0 ? null : left % right;
                    break;
                case '^':
                    result = Math.pow(left, right);
                    break;
                default:
                    result = null;
                    break;
            }

            if (result === null || !isFinite(result)) return null;
            stack.push(result);
            continue;
        }

        if (token.type === 'function') {
            const def = FUNCTION_DEFS[token.value];
            if (!def) return null;
            const argc = token.argCount || 0;

            if (def.variadic) {
                const minArgs = def.minArgs || 1;
                if (argc < minArgs) return null;
            } else if (def.arity !== argc) {
                return null;
            }

            if (stack.length < argc) return null;
            const args = stack.splice(stack.length - argc, argc);
            const result = def.fn(args);
            if (!isFinite(result)) return null;
            stack.push(result);
        }
    }

    if (stack.length !== 1) return null;
    return stack[0];
};

// Math System Controller

/**
 * Initializes math suggestion system for an editor
 * @param {HTMLElement} editor - The contenteditable element
 * @param {Function} positionTooltipAtRange - Function to position tooltip
 * @param {{evalDelay?: number, maxExprLength?: number, maxResultDecimals?: number}} [options]
 * @returns {{destroy: Function}} Controller object with destroy method
 */
export const initMathSystem = (editor, positionTooltipAtRange, options = {}) => {
    const config = {
        evalDelay: Number.isFinite(options.evalDelay) ? Math.max(0, options.evalDelay) : DEFAULT_MATH_CONFIG.evalDelay,
        maxExprLength: Number.isFinite(options.maxExprLength)
            ? Math.max(10, Math.min(200, options.maxExprLength))
            : DEFAULT_MATH_CONFIG.maxExprLength,
        maxResultDecimals: Number.isFinite(options.maxResultDecimals)
            ? Math.max(0, Math.min(10, options.maxResultDecimals))
            : DEFAULT_MATH_CONFIG.maxResultDecimals
    };

    const positionTooltip = typeof positionTooltipAtRange === 'function'
        ? positionTooltipAtRange
        : null;
    let warnedPosition = false;

    /** Timer for debounced math evaluation */
    let mathEvalTimer = null;
    
    /** Current math suggestion state */
    let currentSuggestion = null;

    let enabled = true;
    let isActive = false;
    
    /** Math tooltip element */
    const existingTooltipId = editor?.dataset?.mathTooltipId;
    let mathTooltip = existingTooltipId ? document.getElementById(existingTooltipId) : null;

    if (!mathTooltip) {
        mathTooltip = document.createElement('div');
        mathTooltip.className = 'math-suggestion-tooltip';
        mathTooltip.style.position = 'fixed';
        mathTooltip.style.zIndex = '2000';
        mathTooltip.style.display = 'none';
        mathTooltip.id = `math-suggestion-tooltip-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        if (editor?.dataset) {
            editor.dataset.mathTooltipId = mathTooltip.id;
        }
        document.body.appendChild(mathTooltip);
    } else {
        mathTooltip.style.display = 'none';
    }

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
        const textBefore = getTextBeforeCursor({ range });

        if (!textBefore) {
            hideMathTooltip();
            return;
        }

        const candidate = extractCandidateExpression(textBefore, config.maxExprLength);
        if (!candidate) {
            hideMathTooltip();
            return;
        }

        const normalized = candidate.replace(/\u00A0/g, ' ').trim().replace(/^=/, '').trim();
        if (!normalized || !isLikelyMathExpression(normalized)) {
            hideMathTooltip();
            return;
        }

        const result = evaluateMath(normalized);
        const formatted = result === null ? null : formatMathResult(result, config.maxResultDecimals);

        if (formatted !== null) {
            showMathSuggestion(formatted, range);
        } else {
            hideMathTooltip();
        }
    };

    /**
     * Shows math suggestion tooltip
     * @param {string|number} value - Calculated value
     * @param {Range} range - Text range
     */
    const showMathSuggestion = (value, range) => {
        currentSuggestion = {
            value,
            range: range.cloneRange()
        };

        mathTooltip.textContent = String(value);
        mathTooltip.style.display = 'block';
        if (positionTooltip) {
            positionTooltip(mathTooltip, range);
        } else if (!warnedPosition) {
            console.warn('[Math] positionTooltipAtRange is not a function; tooltip will not be positioned.');
            warnedPosition = true;
        }
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
            const selection = window.getSelection();
            let activeRange = null;

            if (selection && selection.rangeCount) {
                activeRange = selection.getRangeAt(0);
            }

            const isRangeUsable = (r) => {
                if (!r || !r.startContainer) return false;
                if (r.startContainer.nodeType === Node.TEXT_NODE) {
                    return !!r.startContainer.parentNode;
                }
                return r.startContainer.isConnected === true;
            };

            const targetRange = isRangeUsable(range) ? range : activeRange;
            if (!targetRange) return;

            targetRange.deleteContents();
            targetRange.insertNode(document.createTextNode(String(value)));

            // Move cursor after inserted text
            targetRange.collapse(false);
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(targetRange);
            }
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
        mathEvalTimer = setTimeout(handleMathSuggestion, config.evalDelay);
    };

    // Event Handlers

    /**
     * Handles input events for math evaluation
     */
    const handleInputForMath = () => {
        if (!enabled) return;
        scheduleMathEval();
    };

    /**
     * Handles keydown events for math suggestions
     * @param {KeyboardEvent} event
     */
    const handleKeyDownForMath = (event) => {
        if (!enabled) return;

        // Insert math suggestion on Enter or Tab
        if ((event.key === 'Enter' || event.key === 'Tab') && currentSuggestion) {
            event.preventDefault();
            insertMathSuggestion();
        }
    };

    const attach = () => {
        if (isActive) return;

        editor.addEventListener('input', handleInputForMath);
        editor.addEventListener('keydown', handleKeyDownForMath);
        isActive = true;
    };

    const detach = () => {
        if (!isActive) return;

        editor.removeEventListener('input', handleInputForMath);
        editor.removeEventListener('keydown', handleKeyDownForMath);
        isActive = false;
    };

    const setEnabled = (next) => {
        enabled = Boolean(next);

        if (!enabled) {
            if (mathEvalTimer) {
                clearTimeout(mathEvalTimer);
                mathEvalTimer = null;
            }
            hideMathTooltip();
            detach();
            return;
        }

        attach();
    };

    // Event Listener Registration
    setEnabled(true);

    // Public API

    /**
     * Cleanup function to remove math system
     */
    const destroy = () => {
        enabled = false;

        // Remove event listeners
        detach();

        // Clear timer
        if (mathEvalTimer) {
            clearTimeout(mathEvalTimer);
        }

        // Remove tooltip
        mathTooltip.remove();
        if (editor?.dataset?.mathTooltipId === mathTooltip.id) {
            delete editor.dataset.mathTooltipId;
        }

        // Clear suggestion state
        currentSuggestion = null;

        console.log('Math system destroyed');
    };

    return { destroy, setEnabled };
};

export default initMathSystem;
