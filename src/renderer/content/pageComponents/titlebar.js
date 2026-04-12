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
    let isViewTransitioning = false;

    const prefersReducedMotion = () =>
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    const waitForTransitionEnd = (element, fallbackMs = 560) =>
        new Promise((resolve) => {
            if (!element) {
                resolve();
                return;
            }

            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                element.removeEventListener('transitionend', onEnd);
                resolve();
            };
            const onEnd = (event) => {
                if (event.target !== element) return;
                finish();
            };

            element.addEventListener('transitionend', onEnd);
            setTimeout(finish, fallbackMs);
        });

    const animateWorkspaceSwap = async ({ showWorkspace, workspaceContainer, editorContainer }) => {
        if (prefersReducedMotion()) {
            workspaceContainer.style.display = showWorkspace ? 'block' : 'none';
            editorContainer.style.display = showWorkspace ? 'none' : 'block';
            workspaceContainer.classList.toggle('is-active', showWorkspace);
            workspaceContainer.classList.remove('is-entering', 'is-leaving');
            editorContainer.classList.remove('is-workspace-entering', 'is-workspace-leaving');
            return;
        }

        if (showWorkspace) {
            workspaceContainer.style.display = 'block';
            void workspaceContainer.offsetWidth;

            workspaceContainer.classList.remove('is-leaving');
            workspaceContainer.classList.add('is-active', 'is-entering');
            editorContainer.classList.remove('is-workspace-entering');
            editorContainer.classList.add('is-workspace-leaving');

            await Promise.all([
                waitForTransitionEnd(workspaceContainer),
                waitForTransitionEnd(editorContainer)
            ]);

            editorContainer.style.display = 'none';
            workspaceContainer.classList.remove('is-entering');
            editorContainer.classList.remove('is-workspace-leaving');
            return;
        }

        editorContainer.style.display = 'block';
        void editorContainer.offsetWidth;

        editorContainer.classList.remove('is-workspace-leaving');
        editorContainer.classList.add('is-workspace-entering');
        workspaceContainer.classList.remove('is-entering');
        workspaceContainer.classList.add('is-leaving');

        await Promise.all([
            waitForTransitionEnd(workspaceContainer),
            waitForTransitionEnd(editorContainer)
        ]);

        workspaceContainer.classList.remove('is-active', 'is-leaving');
        workspaceContainer.style.display = 'none';
        editorContainer.classList.remove('is-workspace-entering');
    };

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
        console.log('Titlebar: toggleWorkspace called');
        // If already transitioning, wait for it to finish first
        if (isViewTransitioning) {
            await waitForTransitionEnd(workspaceContainer, 560);
            if (isViewTransitioning) return;
        }

        const editorContainer = document.querySelector('.textarea-container');
        if (!workspaceContainer || !editorContainer) return;

        const isWorkspaceVisible =
            workspaceContainer.classList.contains('is-active') ||
            workspaceContainer.style.display === 'block';
        const willShowWorkspace = !isWorkspaceVisible;

        console.log('Titlebar: willShowWorkspace:', willShowWorkspace, 'isWorkspaceInitialized:', isWorkspaceInitialized);

        if (willShowWorkspace && !isWorkspaceInitialized) {
            try {
                workspaceContainer.style.display = 'block';
                workspaceApi = await createWorkspace(workspaceContainer, {
                    onOpenNote: async (noteId) => {
                        if (window.noteAPI && typeof window.noteAPI.openNote === 'function') {
                            await window.noteAPI.openNote(noteId);
                            // close workspace after opening
                            await toggleWorkspace();
                        }
                    },
                    onReturnToEditor: () => {
                        toggleWorkspace();
                    },
                    onOpenCommandPalette: () => {
                        window.__commandPaletteAPI?.toggle('marker');
                    }
                });

                window.__workspaceApi = workspaceApi;
                isWorkspaceInitialized = true;
                console.log('Workspace initialized.');
            } catch (error) {
                console.error('Failed to initialize workspace:', error);
                // Revert UI changes on failure
                workspaceContainer.style.display = 'none';
                editorContainer.style.display = 'block';

                return;
            }
        }

        if (willShowWorkspace) {
            // workspace just became visible and update preview
            const editor = document.querySelector('.editable-div');
            workspaceApi?.refreshCurrentNote && workspaceApi.refreshCurrentNote(editor?.innerHTML || '');
            workspaceApi?.refreshAllNotes && workspaceApi.refreshAllNotes();
        }

        isViewTransitioning = true;
        try {
            await animateWorkspaceSwap({
                showWorkspace: willShowWorkspace,
                workspaceContainer,
                editorContainer
            });
        } finally {
            isViewTransitioning = false;
        }
    };

    const closeMenu = async ({ waitForAnimation = false } = {}) => {
        const wasOpen = menuOpen;
        menuOpen = false;
        if (workspaceMenu) {
            if (workspaceMenu.contains(document.activeElement)) {
                workspaceToggleBtn?.focus();
            }
            workspaceMenu.classList.remove('is-open');
            workspaceMenu.setAttribute('aria-hidden', 'true');
            workspaceMenu.setAttribute('inert', '');

            if (waitForAnimation && wasOpen && !prefersReducedMotion()) {
                await waitForTransitionEnd(workspaceMenu, 220);
            }
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

    /**
     * Ctrl/Cmd + D — always animate, never instant
     * @param {KeyboardEvent} e
     */
    const handleWorkspaceToggleShortcut = async (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        if (e.altKey || e.shiftKey) return;
        if (e.code !== 'KeyD') return;

        e.preventDefault();

        // Close menu first if open, wait for its animation
        await closeMenu({ waitForAnimation: true });

        // Then toggle workspace with full animation
        await toggleWorkspace();
    };

    const listenerOptions = { passive: true };
    window.addEventListener('scroll', onScroll, listenerOptions);

    const handleMarkerClick = async () => {
        console.log('Titlebar: handleMarkerClick called');
        await closeMenu({ waitForAnimation: true });
        await toggleWorkspace();
    };

    workspaceToggleBtn?.addEventListener('click', toggleMenu);
    workspaceMarkerBtn?.addEventListener('click', handleMarkerClick);
    document.addEventListener('mousedown', handleMenuClick);
    document.addEventListener('keydown', handleMenuEscape);
    document.addEventListener('keydown', handleWorkspaceToggleShortcut);

    onScroll();

    return {
        destroy() {
            window.removeEventListener('scroll', onScroll);
            workspaceToggleBtn?.removeEventListener('click', toggleMenu);
            workspaceMarkerBtn?.removeEventListener('click', handleMarkerClick);
            document.removeEventListener('mousedown', handleMenuClick);
            document.removeEventListener('keydown', handleMenuEscape);
            document.removeEventListener('keydown', handleWorkspaceToggleShortcut);
            el.classList.remove('scrolled');
            if (workspaceApi) {
                workspaceApi.destroy();

                if (window.__workspaceApi === workspaceApi) {
                    window.__workspaceApi = null;
                }
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