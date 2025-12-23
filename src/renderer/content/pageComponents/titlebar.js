/**
 * Creates the HTML markup for a custom application title bar.
 * Intended for Electron renderer process usage.
 *
 * @returns {string} HTML markup string for the title bar.
 */
export const createTitlebarMarkup = () => {
    /** @type {string} */
    const markup = `
        <div id="title-bar" class="application-titlebar">
            <span>Fascinate Notes</span>
        </div>
    `;
    
    return markup;
};

/**
 * Handle returned by initTitlebar for lifecycle cleanup.
 * @typedef {Object} TitlebarHandle
 * @property {() => void} destroy Cleanup function.
 */

/**
 * Initializes scroll-based behavior for the title bar.
 * Toggles the `scrolled` class when window scroll exceeds the threshold.
 *
 * @param {number} [threshold=60] Scroll distance in pixels before activating state.
 * @returns {TitlebarHandle}
 */
export const initTitlebar = (threshold = 60) => {
    /** @type {HTMLElement | null} */
    const el =
        document.getElementById('title-bar') ||
        document.querySelector('.application-titlebar');

    if (!el) {
        return { destroy: () => { } };
    }

    /**
     * Scroll event handler.
     * @returns {void}
     */
    const onScroll = () => {
        /** @type {number} */
        const scrollY = window.scrollY;

        if (scrollY > threshold) {
            el.classList.add('scrolled');
        } else {
            el.classList.remove('scrolled');
        }
    };

    /** @type {AddEventListenerOptions} */
    const listenerOptions = { passive: true };

    window.addEventListener('scroll', onScroll, listenerOptions);

    // Initialize state immediately
    onScroll();

    return {
        /**
         * Removes listeners and resets state.
         * @returns {void}
         */
        destroy() {
            window.removeEventListener('scroll', onScroll);
            el.classList.remove('scrolled');
        }
    };
};

/**
 * Factory function for title bar integration.
 * Designed to align with async plugin/extension loaders.
 *
 * @returns {Promise<{ markups: string }>}
 */
export const createTitlebar = async () => {
    /** @type {string} */
    const markups = createTitlebarMarkup();

    return { markups };
};
