import { createWorkspace } from '../../../api/marker/workspace.js';

/**
 * Creates the HTML markup for a custom application title bar.
 * Intended for Electron renderer process usage.
 *
 * @returns {string} HTML markup string for the title bar.
 */
export const createTitlebarMarkup = () => {
    /** @type {string} */
    const markup = `
        <button id="workspace-toggle-btn" class="application-workspace-toggle-button" title="Click here to toggle the marker">☰</button>
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
 * Initializes scroll-based behavior for the title bar and workspace toggle functionality.
 * Toggles the `scrolled` class when window scroll exceeds the threshold.
 *
 * @param {number} [threshold=60] Scroll distance in pixels before activating state.
 * @returns {TitlebarHandle}
 */
export const initTitlebar = (threshold = 60) => {
    const el = document.getElementById('title-bar') || document.querySelector('.application-titlebar');
    const workspaceToggleBtn = document.getElementById('workspace-toggle-btn');
    const workspaceMenu = document.getElementById('workspace-menu');
    const workspaceMarkerBtn = document.getElementById('workspace-open-marker');
    const workspaceContainer = document.getElementById('workspace-container');

    if (!el) {
        return { destroy: () => { } };
    }

    let workspaceApi = null;
    let isWorkspaceInitialized = false;
    let menuOpen = false;

    const onScroll = () => {
        /** @type {number} */
        const scrollY = window.scrollY;

        if (scrollY > threshold) {
            el.classList.add('scrolled');
        } else {
            el.classList.remove('scrolled');
        }
    };

    const toggleWorkspace = async () => {
        const editorContainer = document.querySelector('.textarea-container');
        if (!workspaceContainer || !editorContainer) return;

        const isWorkspaceVisible = workspaceContainer.style.display === 'block';
        workspaceContainer.style.display = isWorkspaceVisible ? 'none' : 'block';
        editorContainer.style.display = isWorkspaceVisible ? 'block' : 'none';

        if (!isWorkspaceVisible && !isWorkspaceInitialized) {
            try {
                workspaceApi = await createWorkspace(workspaceContainer);
                isWorkspaceInitialized = true;
                console.log('Workspace initialized.');
            } catch (error) {
                console.error('Failed to initialize workspace:', error);
                // Revert UI changes on failure
                workspaceContainer.style.display = 'none';
                editorContainer.style.display = 'block';
            }
        }

        if (!isWorkspaceVisible && workspaceApi?.refreshCurrentNote) {
            const editor = document.querySelector('.editable-div');
            workspaceApi.refreshCurrentNote(editor?.innerHTML || '');
        }
    };

    const closeMenu = () => {
        menuOpen = false;
        if (workspaceMenu) {
            if (workspaceMenu.contains(document.activeElement)) {
                workspaceToggleBtn?.focus();
            }
            workspaceMenu.classList.remove('is-open');
            workspaceMenu.setAttribute('aria-hidden', 'true');
            workspaceMenu.setAttribute('inert', '');
        }
    };

    const openMenu = () => {
        menuOpen = true;
        if (workspaceMenu) {
            workspaceMenu.classList.add('is-open');
            workspaceMenu.setAttribute('aria-hidden', 'false');
            workspaceMenu.removeAttribute('inert');
        }
    };

    const toggleMenu = () => {
        if (!workspaceMenu) return;
        menuOpen ? closeMenu() : openMenu();
    };

    const handleMenuClick = (e) => {
        if (!workspaceMenu || !menuOpen) return;
        if (workspaceMenu.contains(e.target) || workspaceToggleBtn?.contains(e.target)) {
            return;
        }
        closeMenu();
    };

    const handleMenuEscape = (e) => {
        if (e.key !== 'Escape') return;
        if (menuOpen) {
            closeMenu();
        }
    };

    const listenerOptions = { passive: true };
    window.addEventListener('scroll', onScroll, listenerOptions);
    const handleMarkerClick = async () => {
        await toggleWorkspace();
        closeMenu();
    };

    workspaceToggleBtn?.addEventListener('click', toggleMenu);
    workspaceMarkerBtn?.addEventListener('click', handleMarkerClick);
    document.addEventListener('mousedown', handleMenuClick);
    document.addEventListener('keydown', handleMenuEscape);

    onScroll();

    return {
        destroy() {
            window.removeEventListener('scroll', onScroll);
            workspaceToggleBtn?.removeEventListener('click', toggleMenu);
            workspaceMarkerBtn?.removeEventListener('click', handleMarkerClick);
            document.removeEventListener('mousedown', handleMenuClick);
            document.removeEventListener('keydown', handleMenuEscape);
            el.classList.remove('scrolled');
            if (workspaceApi) {
                workspaceApi.destroy();
            }
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
