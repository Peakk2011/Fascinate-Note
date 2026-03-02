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
        <button id="workspace-toggle-btn" class="application-workspace-toggle-button" title="Click here to toggle the marker">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--theme-fg)"><path d="M183.5-183.5Q160-207 160-240t23.5-56.5Q207-320 240-320t56.5 23.5Q320-273 320-240t-23.5 56.5Q273-160 240-160t-56.5-23.5Zm240 0Q400-207 400-240t23.5-56.5Q447-320 480-320t56.5 23.5Q560-273 560-240t-23.5 56.5Q513-160 480-160t-56.5-23.5Zm240 0Q640-207 640-240t23.5-56.5Q687-320 720-320t56.5 23.5Q800-273 800-240t-23.5 56.5Q753-160 720-160t-56.5-23.5Zm-480-240Q160-447 160-480t23.5-56.5Q207-560 240-560t56.5 23.5Q320-513 320-480t-23.5 56.5Q273-400 240-400t-56.5-23.5Zm240 0Q400-447 400-480t23.5-56.5Q447-560 480-560t56.5 23.5Q560-513 560-480t-23.5 56.5Q513-400 480-400t-56.5-23.5Zm240 0Q640-447 640-480t23.5-56.5Q687-560 720-560t56.5 23.5Q800-513 800-480t-23.5 56.5Q753-400 720-400t-56.5-23.5Zm-480-240Q160-687 160-720t23.5-56.5Q207-800 240-800t56.5 23.5Q320-753 320-720t-23.5 56.5Q273-640 240-640t-56.5-23.5Zm240 0Q400-687 400-720t23.5-56.5Q447-800 480-800t56.5 23.5Q560-753 560-720t-23.5 56.5Q513-640 480-640t-56.5-23.5Zm240 0Q640-687 640-720t23.5-56.5Q687-800 720-800t56.5 23.5Q800-753 800-720t-23.5 56.5Q753-640 720-640t-56.5-23.5Z"/></svg>
        </button>
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
                workspaceApi = await createWorkspace(workspaceContainer, {
                    onOpenNote: async (noteId) => {
                        if (window.noteAPI && typeof window.noteAPI.openNote === 'function') {
                            await window.noteAPI.openNote(noteId);
                            // close workspace after opening
                            toggleWorkspace();
                        }
                    },
                    onReturnToEditor: () => {
                        toggleWorkspace();
                    }
                });
                isWorkspaceInitialized = true;
                console.log('Workspace initialized.');
            } catch (error) {
                console.error('Failed to initialize workspace:', error);
                // Revert UI changes on failure
                workspaceContainer.style.display = 'none';
                editorContainer.style.display = 'block';
            }
        }

        if (!isWorkspaceVisible) {
            // workspace just became visible and update preview
            const editor = document.querySelector('.editable-div');
            workspaceApi?.refreshCurrentNote && workspaceApi.refreshCurrentNote(editor?.innerHTML || '');
            workspaceApi?.refreshAllNotes && workspaceApi.refreshAllNotes();
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
