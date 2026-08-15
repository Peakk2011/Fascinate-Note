import { initRealtimeCollab } from '@collab/realtimeCollab.js';
import Hammer from 'hammerjs';

/**
 * @roadmap Planned, not yet implemented — direction agreed, no code written:
 * 1. Room auth (OTP flow): room owner signs in via Firebase Auth
 *    (Google/GitHub) -> gets a 6-digit code with a TTL -> guests join with
 *    the code + a name -> guest enters the room as "NAME (Guest)".
 * 2. Code verification rate limiting must happen in a Cloud Function
 *    (server-side) — never a raw client-side Firestore check.
 * 3. Realtime sync transport: migrate from y-websocket (self-hosted server)
 *    to y-partyserver (Cloudflare Workers + Durable Objects — managed,
 *    free). Only the WebsocketProvider import in realtimeCollab.js changes;
 *    server-side Worker code not written yet.
 * 4. wss:// becomes automatic once on Cloudflare Workers (always https) —
 *    no separate fix needed, comes free with #3.
 * 5. Document persistence: use the Durable Object's own storage
 *    (onLoad/onSave hooks) instead of y-websocket's LevelDB persistence.
 */

const STORAGE_KEY_USER = 'fascinate-collab-user-name';
const STORAGE_KEY_HISTORY = 'fascinate-collab-history';
const STORAGE_KEY_PROFILE = 'fascinate-collab-profile';
const ROOM_LIMIT = 3;
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_REGEX = /^\d{6}$/;
const NAME_REGEX = /^[\p{L}\p{N}\s._-]{1,32}$/u;
const SESSION_KEY = 'fascinate-collab-session-id';
const GRACE_PERIOD_MS = 90 * 1000; // 90s default grace period before auto-close
const STEP_ANIMATION_MS = 380;
const MODAL_ANIMATION_MS = 500;
const AUTO_SAVE_DELAY = 700; // Per spec: 500ms-1s after the user stops editing, before sending data to the Collab Server
const SYNC_RETRY_DELAY = 4000;
const CROP_OUTPUT_SIZE = 512; // Output image size after cropping (pixels)
const CROP_VIEWPORT_SIZE = 80; // On-screen crop viewport size (pixels, matches CSS)
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const VALID_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const PERSON_PLACEHOLDER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="70%" height="70%" fill="currentColor" aria-hidden="true"><path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/></svg>`;

// Swipe-to-delete tuning (Hammer.js Pan recognizer)
const SWIPE_OPEN_OFFSET = 90;        // px the card stays translated to reveal the delete button
const SWIPE_MAX_DRAG = 130;          // px clamp on drag distance either direction
const SWIPE_DELETE_VELOCITY = 0.65;  // px/ms flick speed that triggers an instant delete

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createRoomCode = (history = []) => {
    const existing = new Set(history.map((item) => item.roomCode));
    let code;

    do {
        code = String(Math.floor(Math.random() * 1_000_000)).padStart(ROOM_CODE_LENGTH, '0');
    } while (existing.has(code));

    return code;
};

const uuidv4 = () => {
    // simple RFC4122 v4 UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

const loadSavedState = () => {
    let userName = '';
    let history = [];
    let profile = null;

    try {
        userName = localStorage.getItem(STORAGE_KEY_USER) || '';
    } catch {
        userName = '';
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
        history = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(history)) {
            history = [];
        }
    } catch {
        history = [];
    }

    try {
        const profileRaw = localStorage.getItem(STORAGE_KEY_PROFILE);
        profile = profileRaw ? JSON.parse(profileRaw) : null;
    } catch {
        profile = null;
    }

    return { userName, history, profile };
};

const persistState = ({ userName, history, profile }) => {
    try {
        localStorage.setItem(STORAGE_KEY_USER, userName || '');
    } catch {
        // ignore
    }

    try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify((history || []).slice(0, 20)));
    } catch {
        // ignore
    }

    try {
        if (profile) {
            localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
        } else {
            localStorage.removeItem(STORAGE_KEY_PROFILE);
        }
    } catch {
        // ignore
    }
};

// Wipes all account data from this device's Local Storage (used only for Delete Account)
const wipeLocalAccountData = () => {
    try {
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_HISTORY);
        localStorage.removeItem(STORAGE_KEY_PROFILE);
    } catch {
        // ignore
    }
    try {
        sessionStorage.removeItem(SESSION_KEY);
    } catch {
        // ignore
    }
};

const sanitizeUserName = (value) => String(value || '').trim();

const isValidUserName = (value) => {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 && NAME_REGEX.test(trimmed);
};

// Ensures the value is a single emoji (supports basic surrogate pairs / ZWJ), not multiple regular characters
const isLikelySingleEmoji = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return false;
    try {
        const segments = Array.from(trimmed);
        return segments.length >= 1 && segments.length <= 1 && /\p{Extended_Pictographic}/u.test(trimmed);
    } catch {
        // Older browsers without Unicode property escapes: fall back to a length check
        return trimmed.length <= 2;
    }
};

// Delete layer sits behind the card (see .collab-share-history-item-delete
// in the CSS) and is revealed once the card slides away on swipe.
const buildHistoryItemMarkup = (item) => {
    const statusLabel = item.status === 'active' ? 'Active' : 'Closed';
    return `
        <li class="collab-share-history-item-wrap" data-room-code="${item.roomCode}">
            <div class="collab-share-history-item-delete" aria-hidden="true">
                <button type="button" class="collab-share-history-delete-btn" data-action="delete" data-room-code="${item.roomCode}" aria-label="Delete room">Delete</button>
            </div>
            <div class="collab-share-history-item ${item.status === 'active' ? 'is-active' : ''}" data-room-code="${item.roomCode}">
                <div class="collab-share-history-meta">
                    <div class="collab-share-history-title">${item.roomName || `Room ${item.roomCode}`}</div>
                    <div class="collab-share-history-subtitle">${item.roomCode} ${statusLabel}</div>
                </div>
                <div class="collab-share-history-actions">
                <span class="collab-share-history-count">${item.participants || 0} People</span>
                    ${item.status === 'active' ? `<button type="button" class="collab-share-history-button collab-share-history-close" data-action="close" data-room-code="${item.roomCode}">Close</button>` : `<button type="button" class="collab-share-history-button collab-share-history-rejoin" data-action="rejoin" data-room-code="${item.roomCode}">Rejoin</button>`}
                </div>
            </div>
        </li>
    `;
};

/**
 * Creates the HTML markup for the Share & Collaborate modal.
 * NOTE: profile editing no longer lives here - it moved to the workspace menu
 * (see workspaceMenu.js, #workspace-menu-profile-view).
 */
export const createCollabShareMarkup = () => `

    <div id="collab-share-root" class="collab-share-root">
        <div id="collab-share-panel" class="collab-share-panel">
            <div id="collab-share-overlay" class="collab-share-overlay"></div>
            <section id="collab-share-modal" class="collab-share-modal" role="dialog" aria-modal="true" aria-labelledby="collab-share-title">
            <div class="collab-share-modal-inner">
                <div class="collab-share-header-bar">
                    <div class="collab-share-header-left">
                        <button id="collab-share-back" class="collab-share-back is-muted" type="button" aria-label="Back" aria-disabled="true">
                            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5.25 10L0 5L5.25 0L6.475 1.20833L3.36875 4.16667H14V5.83333H3.36875L6.475 8.79167L5.25 10Z" fill="currentColor" fill-opacity="1"/>
                            </svg>
                        </button>
                        <button id="collab-share-minimized" class="collab-share-minimized" type="button" aria-label="Open collaboration session">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path opacity="1" d="M1.33333 12C0.966667 12 0.652778 11.8694 0.391667 11.6083C0.130556 11.3472 0 11.0333 0 10.6667V1.33333C0 0.966667 0.130556 0.652778 0.391667 0.391667C0.652778 0.130556 0.966667 0 1.33333 0H10.6667C11.0333 0 11.3472 0.130556 11.6083 0.391667C11.8694 0.652778 12 0.966667 12 1.33333V10.6667C12 11.0333 11.8694 11.3472 11.6083 11.6083C11.3472 11.8694 11.0333 12 10.6667 12H1.33333ZM3.33333 10.6667V1.33333H1.33333V10.6667H3.33333ZM4.66667 10.6667H10.6667V1.33333H4.66667V10.6667Z" fill="currentColor"/>
                            </svg>
                            <span id="collab-share-minimized-badge" class="collab-share-minimized-badge hidden"></span>
                        </button>
                    </div>
                    <div class="collab-share-header-right">
                        <button id="collab-share-close" class="collab-share-close" type="button" aria-label="Close collaboration panel">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M0.98 14L0 13.02L4.62 8.4H1.4V7H7V12.6H5.6V9.38L0.98 14ZM7 7V1.4H8.4V4.62L13.02 0L14 0.98L9.38 5.6H12.6V7H7Z" fill="currentColor" fill-opacity="1"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div id="collab-share-content" class="collab-share-content">
                <h2 id="collab-share-title" class="collab-share-title">Share &amp;<br>Collaborate</h2>
                <p class="collab-share-description">Create or join a collaboration room</p>

                <div id="collab-share-steps-viewport" class="collab-share-steps-viewport">
                <div class="collab-share-steps">
                    <div id="collab-share-step-welcome" class="collab-share-step is-active" data-step="collab-share-step-welcome">
                        <label for="collab-share-name" class="collab-share-label">Your Name<br>(English Only, Thai vowels can't be included)</label>
                        <input id="collab-share-name" class="collab-share-input" type="text" placeholder="Example: Peakk" autocomplete="name" maxlength="32" />
                        <div id="collab-share-name-error" class="collab-share-error" aria-live="polite"></div>
                        <button id="collab-share-next-step" class="collab-share-primary-button" type="button" disabled>
                            <span>Next</span>
                        </button>
                    </div>

                    <div id="collab-share-step-action" class="collab-share-step hidden" data-step="collab-share-step-action">
                        <div class="collab-share-action-grid">
                            <button id="collab-share-action-join" class="collab-share-choice" type="button">
                                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<path opacity="0.65" d="M22.0455 26.3636L20.6137 24.8258L24.2444 21.0606H11.8182V18.9394H24.2444L20.6137 15.1742L22.0455 13.6364L28.1819 20L22.0455 26.3636Z" fill="currentColor"/>
</svg>

                                <span class="collab-share-choice-label">Join Room</span>
                            </button>
                            <button id="collab-share-action-create" class="collab-share-choice" type="button">
                            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<path opacity="0.65" d="M22.0455 26.3636L20.6137 24.8258L24.2444 21.0606H11.8182V18.9394H24.2444L20.6137 15.1742L22.0455 13.6364L28.1819 20L22.0455 26.3636Z" fill="currentColor"/>
</svg>

                                <span class="collab-share-choice-label">Create Room</span>
                            </button>
                        </div>
                    </div>

                    <div id="collab-share-step-join" class="collab-share-step hidden" data-step="collab-share-step-join">
                        <h3 class="collab-share-step-title">Join Room</h3>
                        <label class="collab-share-label collab-share-label-row">
                            <span>6-digit room code:</span>
                        </label>
                        <div id="collab-share-otp-group" class="collab-share-otp-group">
                            ${Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => `<input id="collab-share-otp-${index}" class="collab-share-otp-input" type="text" inputmode="numeric" pattern="\d*" maxlength="1" aria-label="Digit ${index + 1}" />`).join('')}
                        </div>
                        <div id="collab-share-otp-error" class="collab-share-error" aria-live="polite"></div>
                        <p class="collab-share-hint">Enter all 6 digits to join instantly</p>
                    </div>

                    <div id="collab-share-step-create" class="collab-share-step hidden" data-step="collab-share-step-create">
                        <h3 class="collab-share-step-title">Create Room</h3>
                        <div class="collab-share-label-row">
                            <span class="collab-share-label">Room name:</span>
                            <span id="collab-share-room-count" class="collab-share-meta">0/${ROOM_LIMIT} rooms</span>
                        </div>
                        <input id="collab-share-room-name" class="collab-share-input" type="text" placeholder="Example: My Romance Room" maxlength="42" />
                        <div id="collab-share-create-error" class="collab-share-error" aria-live="polite"></div>
                        <div class="collab-share-footer-row">
                            <button id="collab-share-manage-rooms" class="collab-share-secondary-button hidden" type="button">Manage</button>
                            <button id="collab-share-create-room" class="collab-share-pill-button" type="button" disabled>Create</button>
                        </div>
                    </div>
                </div>
                </div>
                </div>
            </div>
        </section>
        </div>

        <aside id="collab-share-sidebar" class="collab-share-sidebar hidden" aria-label="Collaboration side panel">
            <div class="collab-share-sidebar-header">
                <div class="collab-share-sidebar-header-left">
                    <button id="collab-share-sidebar-back" class="collab-share-back" type="button" aria-label="Back">
                        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5.25 10L0 5L5.25 0L6.475 1.20833L3.36875 4.16667H14V5.83333H3.36875L6.475 8.79167L5.25 10Z" fill="currentColor" fill-opacity="1"/>
                        </svg>
                    </button>
                </div>
                <div class="collab-share-sidebar-header-main">
                    <h3>Active Room</h3>
                    <p id="collab-share-sidebar-room-label" class="collab-share-sidebar-subtitle">No active session</p>
                </div>
                <button id="collab-share-sidebar-close" class="collab-share-close" type="button" aria-label="Close side panel">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0.98 14L0 13.02L4.62 8.4H1.4V7H7V12.6H5.6V9.38L0.98 14ZM7 7V1.4H8.4V4.62L13.02 0L14 0.98L9.38 5.6H12.6V7H7Z" fill="currentColor" fill-opacity="1"/>
                    </svg>
                </button>
            </div>
            <div class="collab-share-sidebar-content">
                <div id="collab-share-current-session" class="collab-share-current-session hidden"></div>
                <div class="collab-share-history-panel">
                    <div class="collab-share-history-header">
                        <strong>History</strong>
                        <span id="collab-share-history-summary" class="collab-share-meta">0 room</span>
                    </div>
                    <ul id="collab-share-history-list" class="collab-share-history-list"></ul>
                </div>
            </div>
        </aside>

        <div id="collab-share-toast-container" class="collab-share-toast-container" aria-live="polite"></div>
    </div>
`;

const getJoinCode = () => {
    const values = Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => {
        const input = document.getElementById(`collab-share-otp-${index}`);
        return input?.value || '';
    });
    return values.join('');
};

const createCurrentSessionMarkup = (session) => {
    if (!session) {
        return `<div class="collab-share-current-empty">No active session</div>`;
    }

    return `
        <div class="collab-share-current-card">
            <!-- <div class="collab-share-current-row"><span class="collab-share-current-label">Room:</span> <strong>${session.roomName || `Room ${session.roomCode}`}</strong></div> -->
            <h1>${session.roomName}</h1>
            <div class="collab-share-current-row">
                <strong>${session.roomCode}</strong>
                <strong id="collab-share-participants-count">${session.participants || 1} people</strong>
            </div>
            <div id="collab-share-participants-list" class="collab-share-participants-list"></div>
            
            <!--
            <div class="collab-share-current-row">
                <span class="collab-share-current-label">Sync status:</span>
                <strong id="collab-share-sync-indicator">${session.status === 'active' ? 'Synced' : 'Closed'}</strong>
            </div>
            -->

            <div class="collab-share-current-actions">
                <button type="button" class="collab-share-primary-button" id="collab-share-copy-room-code">Copy Code</button>
                <button type="button" class="collab-share-secondary-button" id="collab-share-leave-room">Leave Room</button>
            </div>
        </div>
    `;
};

export const initCollabShare = ({ config, editorElement, noteAPI } = {}) => {
    const root = document.getElementById('collab-share-root');
    if (!root) {
        return { destroy: () => { } };
    }

    const emitSessionChange = (active) => {
        document.dispatchEvent(new CustomEvent('collab:session-changed', {
            detail: { active: Boolean(active) }
        }));
    };

    window.__collabShareAPI = {
        isSessionActive: () => Boolean(state.activeSession)
    };

    const state = {
        userName: '',
        userColor: '',
        history: [],
        activeSession: null,
        collabController: null,
        presenceInterval: null,
        reconnectTimeout: null,
        connectionState: 'idle',
        // Profile fields
        profileImage: null, // base64 (cropped 1:1), or null when using a custom emoji profile
        profileEmoji: '',
        profileBackground: '',
        profileBio: '',       // Optional - free-form bio
        profilePronouns: '',  // Optional - pronouns
        profileDisplayName: '', // Optional - display name shown in rooms
        hasProfile: false,
        profileSyncTimer: null,
        profileSyncRetryTimer: null,
        profileSyncStatus: 'idle',
        // Crop tool state
        cropImageEl: null,
        cropNaturalWidth: 0,
        cropNaturalHeight: 0,
        cropScale: 1,
        cropOffsetX: 0,
        cropOffsetY: 0,
        cropDragging: false,
        cropDragStartX: 0,
        cropDragStartY: 0,
        cropDragOriginX: 0,
        cropDragOriginY: 0,
        // Crop history stacks for undo/redo (each entry: { scale, offsetX, offsetY })
        cropHistory: [],
        cropFuture: []
    };

    // session-scoped identity so each tab is unique
    if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, uuidv4());
    }
    state.sessionId = sessionStorage.getItem(SESSION_KEY);
    state.pendingCreateRequestId = null;
    state.heartbeatInterval = null;
    state.ownerGraceTimer = null;

    const elements = {
        shareButton: document.getElementById('collab-share-btn'),
        minimizedButton: document.getElementById('collab-share-minimized'),
        minimizedBadge: document.getElementById('collab-share-minimized-badge'),
        panel: document.getElementById('collab-share-panel'),
        overlay: document.getElementById('collab-share-overlay'),
        modal: document.getElementById('collab-share-modal'),
        closeModal: document.getElementById('collab-share-close'),
        backButton: document.getElementById('collab-share-back'),
        sidebar: document.getElementById('collab-share-sidebar'),
        closeSidebar: document.getElementById('collab-share-sidebar-close'),
        toastContainer: document.getElementById('collab-share-toast-container'),
        nameInput: document.getElementById('collab-share-name'),
        nameError: document.getElementById('collab-share-name-error'),
        nextStepButton: document.getElementById('collab-share-next-step'),
        actionJoin: document.getElementById('collab-share-action-join'),
        actionCreate: document.getElementById('collab-share-action-create'),
        otpGroup: document.getElementById('collab-share-otp-group'),
        otpError: document.getElementById('collab-share-otp-error'),
        roomNameInput: document.getElementById('collab-share-room-name'),
        roomCount: document.getElementById('collab-share-room-count'),
        createRoomButton: document.getElementById('collab-share-create-room'),
        createError: document.getElementById('collab-share-create-error'),
        manageRoomsButton: document.getElementById('collab-share-manage-rooms'),
        sidebarRoomLabel: document.getElementById('collab-share-sidebar-room-label'),
        currentSession: document.getElementById('collab-share-current-session'),
        historySummary: document.getElementById('collab-share-history-summary'),
        historyList: document.getElementById('collab-share-history-list'),
        stepsViewport: document.getElementById('collab-share-steps-viewport'),
        contentArea: document.getElementById('collab-share-content'),
        title: document.getElementById('collab-share-title'),
        description: document.querySelector('.collab-share-description'),
        sidebarBack: document.getElementById('collab-share-sidebar-back')
    };

    // FIX: root must never intercept clicks on the page underneath it.
    root.style.pointerEvents = 'none';
    [elements.minimizedButton, elements.panel, elements.sidebar, elements.toastContainer].forEach((el) => {
        if (el) el.style.pointerEvents = 'auto';
    });

    state.modalHistory = [];
    state.currentStep = 'collab-share-step-welcome';
    state.isStepAnimating = false;
    state.isModalAnimating = false;
    state.sidebarReturnTo = null;

    // NOTE: the profile step no longer exists inside this modal - it now lives in the workspace menu.
    const ROOT_STEPS = new Set(['collab-share-step-welcome', 'collab-share-step-action']);
    const ALL_STEPS = [
        'collab-share-step-welcome',
        'collab-share-step-action',
        'collab-share-step-join',
        'collab-share-step-create'
    ];

    const getStepElement = (stepId) => document.getElementById(stepId);

    const measureStepHeight = (stepEl) => {
        if (!stepEl) return 0;
        const wasHidden = stepEl.classList.contains('hidden');
        const prevStyle = stepEl.style.cssText;
        stepEl.classList.remove('hidden');
        stepEl.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:100%;left:0;top:0;';
        const height = stepEl.offsetHeight;
        stepEl.style.cssText = prevStyle;
        if (wasHidden) stepEl.classList.add('hidden');
        return height;
    };

    // Profile modal step-slide (options <-> upload/custom/delete)

    const PROFILE_STEP_IDS = {
        view: 'wm-profile-step-view',
        options: 'wm-profile-step-options',
        upload: 'wm-profile-step-upload',
        custom: 'wm-profile-step-custom',
        details: 'wm-profile-step-details',
        delete: 'wm-profile-step-delete'
    };
    const ALL_PROFILE_STEPS = Object.keys(PROFILE_STEP_IDS);

    state.profileCurrentStep = 'view';
    state.isProfileStepAnimating = false;

    const getProfileStepElement = (step) => document.getElementById(PROFILE_STEP_IDS[step]);

    const measureProfileStepHeight = (stepEl) => {
        if (!stepEl) return 0;
        const wasHidden = stepEl.classList.contains('hidden');
        const prevStyle = stepEl.style.cssText;
        stepEl.classList.remove('hidden');
        stepEl.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:100%;left:0;top:0;';
        const height = stepEl.offsetHeight;
        stepEl.style.cssText = prevStyle;
        if (wasHidden) stepEl.classList.add('hidden');
        return height;
    };

    // Immediately snaps to a step with no animation - used on modal close/reset.
    const applyProfileStepImmediate = (step) => {
        ALL_PROFILE_STEPS.forEach((stepId) => {
            const el = getProfileStepElement(stepId);
            if (!el) return;
            const isActive = stepId === step;
            el.classList.toggle('hidden', !isActive);
            el.classList.toggle('is-active', isActive);
            el.classList.remove(
                'is-sliding',
                'wm-slide-out-left', 'wm-slide-out-right',
                'wm-slide-in-left', 'wm-slide-in-right',
                'wm-slide-out-left-active', 'wm-slide-out-right-active',
                'wm-slide-in-left-active', 'wm-slide-in-right-active'
            );
        });
        state.profileCurrentStep = step;
    };

    const setProfileStep = async (step, { direction = 'forward' } = {}) => {
        if (!ALL_PROFILE_STEPS.includes(step) || state.isProfileStepAnimating || step === state.profileCurrentStep) {
            return;
        }

        const fromStep = state.profileCurrentStep;
        const fromEl = getProfileStepElement(fromStep);
        const toEl = getProfileStepElement(step);
        if (!fromEl || !toEl) return;

        state.isProfileStepAnimating = true;

        const fromHeight = measureProfileStepHeight(fromEl);
        const toHeight = measureProfileStepHeight(toEl);

        const body = document.getElementById('workspace-menu-view-body');
        const viewport = document.getElementById('workspace-menu-profile-viewport');

        if (body) body.style.height = `${fromHeight}px`;
        if (viewport) viewport.style.height = `${fromEl.offsetHeight || 0}px`;

        fromEl.classList.add('is-sliding', direction === 'forward' ? 'wm-slide-out-left' : 'wm-slide-out-right');
        toEl.classList.remove('hidden');
        toEl.classList.add('is-sliding', direction === 'forward' ? 'wm-slide-in-right' : 'wm-slide-in-left');

        requestAnimationFrame(() => {
            if (body) body.style.height = `${toHeight}px`;
            if (viewport) viewport.style.height = `${measureProfileStepHeight(toEl)}px`;
            fromEl.classList.add(direction === 'forward' ? 'wm-slide-out-left-active' : 'wm-slide-out-right-active');
            toEl.classList.add(direction === 'forward' ? 'wm-slide-in-right-active' : 'wm-slide-in-left-active');
        });

        await sleep(STEP_ANIMATION_MS);

        fromEl.classList.add('hidden');
        fromEl.classList.remove(
            'is-active', 'is-sliding',
            'wm-slide-out-left', 'wm-slide-out-right',
            'wm-slide-out-left-active', 'wm-slide-out-right-active'
        );
        toEl.classList.add('is-active');
        toEl.classList.remove(
            'is-sliding',
            'wm-slide-in-left', 'wm-slide-in-right',
            'wm-slide-in-left-active', 'wm-slide-in-right-active'
        );

        if (viewport) viewport.style.height = '';
        if (body) {
            body.style.height = `${toHeight}px`;
            requestAnimationFrame(() => { body.style.height = 'auto'; });
        }

        state.profileCurrentStep = step;
        state.isProfileStepAnimating = false;
    };

    // 

    const measureContentHeight = ({ step, showRootHeading } = {}) => {
        const content = elements.contentArea;
        if (!content) return 0;

        const targetStep = step || state.currentStep;
        const showHeading = showRootHeading ?? ROOT_STEPS.has(targetStep);
        const prevTitleHidden = elements.title?.classList.contains('hidden');
        const prevDescHidden = elements.description?.classList.contains('hidden');

        elements.title?.classList.toggle('hidden', !showHeading);
        elements.description?.classList.toggle('hidden', !showHeading);

        const prevStates = ALL_STEPS.map((stepId) => {
            const el = getStepElement(stepId);
            return {
                el,
                hidden: el?.classList.contains('hidden'),
                active: el?.classList.contains('is-active')
            };
        });

        ALL_STEPS.forEach((stepId) => {
            const el = getStepElement(stepId);
            if (!el) return;
            const isActive = stepId === targetStep;
            el.classList.toggle('hidden', !isActive);
            el.classList.toggle('is-active', isActive);
        });

        const height = content.offsetHeight;

        prevStates.forEach(({ el, hidden, active }) => {
            if (!el) return;
            el.classList.toggle('hidden', hidden);
            el.classList.toggle('is-active', active);
        });
        elements.title?.classList.toggle('hidden', prevTitleHidden);
        elements.description?.classList.toggle('hidden', prevDescHidden);

        return height;
    };

    const updateBackButton = () => {
        if (!elements.backButton) return;
        const isAtRoot = state.modalHistory.length === 0;
        elements.backButton.classList.toggle('is-muted', isAtRoot);
        elements.backButton.setAttribute('aria-disabled', isAtRoot ? 'true' : 'false');
    };

    const updateRootHeadingVisibility = (step) => {
        const showRootHeading = ROOT_STEPS.has(step);
        elements.title?.classList.toggle('hidden', !showRootHeading);
        elements.description?.classList.toggle('hidden', !showRootHeading);
    };

    const applyStepImmediate = (step) => {
        ALL_STEPS.forEach((stepId) => {
            const el = getStepElement(stepId);
            if (!el) return;
            const isActive = stepId === step;
            el.classList.toggle('hidden', !isActive);
            el.classList.toggle('is-active', isActive);
            el.classList.remove(
                'slide-out-left',
                'slide-out-right',
                'slide-in-left',
                'slide-in-right',
                'is-sliding'
            );
        });

        state.currentStep = step;
        updateRootHeadingVisibility(step);
        updateBackButton();
    };

    const setStep = async (step, { direction = 'forward', skipHistory = false } = {}) => {
        if (!ALL_STEPS.includes(step) || state.isStepAnimating || step === state.currentStep) {
            return;
        }

        const fromStep = state.currentStep;
        const fromEl = getStepElement(fromStep);
        const toEl = getStepElement(step);
        if (!fromEl || !toEl) return;

        if (!skipHistory && direction === 'forward') {
            state.modalHistory.push(fromStep);
        }

        state.isStepAnimating = true;

        const fromHeight = measureContentHeight({ step: fromStep, showRootHeading: ROOT_STEPS.has(fromStep) });
        const toHeight = measureContentHeight({ step, showRootHeading: ROOT_STEPS.has(step) });

        updateRootHeadingVisibility(step);
        updateBackButton();

        const content = elements.contentArea;
        if (content) {
            content.style.height = `${fromHeight}px`;
        }

        const viewport = elements.stepsViewport;
        if (viewport) {
            viewport.style.height = `${fromEl.offsetHeight || 0}px`;
        }

        fromEl.classList.add('is-sliding', direction === 'forward' ? 'slide-out-left' : 'slide-out-right');
        toEl.classList.remove('hidden');
        toEl.classList.add('is-sliding', direction === 'forward' ? 'slide-in-right' : 'slide-in-left');

        requestAnimationFrame(() => {
            if (content) {
                content.style.height = `${toHeight}px`;
            }
            if (viewport) {
                viewport.style.height = `${measureStepHeight(toEl)}px`;
            }
            fromEl.classList.add(direction === 'forward' ? 'slide-out-left-active' : 'slide-out-right-active');
            toEl.classList.add(direction === 'forward' ? 'slide-in-right-active' : 'slide-in-left-active');
        });

        await sleep(STEP_ANIMATION_MS);

        fromEl.classList.add('hidden');
        fromEl.classList.remove(
            'is-active',
            'is-sliding',
            'slide-out-left',
            'slide-out-right',
            'slide-out-left-active',
            'slide-out-right-active'
        );
        toEl.classList.add('is-active');
        toEl.classList.remove(
            'is-sliding',
            'slide-in-left',
            'slide-in-right',
            'slide-in-left-active',
            'slide-in-right-active'
        );

        if (viewport) {
            viewport.style.height = '';
        }
        if (content) {
            content.style.height = `${toHeight}px`;
            requestAnimationFrame(() => {
                content.style.height = 'auto';
            });
        }

        state.currentStep = step;
        state.isStepAnimating = false;
    };

    const goBackInModal = () => {
        if (state.isStepAnimating || state.modalHistory.length === 0) {
            return;
        }
        const prev = state.modalHistory.pop();
        setStep(prev, { direction: 'back', skipHistory: true });
    };

    const setRootVisible = (visible) => {
        if (visible) {
            root.style.display = 'block';
            root.classList.add('is-visible');
        } else {
            root.style.display = 'none';
            root.classList.remove('is-visible');
        }
    };

    const setPanelVisible = (visible) => {
        if (!elements.panel) return;

        if (visible) {
            elements.panel.classList.remove('hidden');
            elements.panel.style.display = 'block';
            elements.panel.style.pointerEvents = 'auto';
            elements.panel.classList.add('is-visible');
            root.classList.add('is-open');
            requestAnimationFrame(() => {
                elements.overlay?.classList.add('is-visible');
            });
        } else {
            elements.panel.classList.remove('is-visible');
            root.classList.remove('is-open');
            elements.overlay?.classList.remove('is-visible');

            // Guard against being called again before the previous hide finished.
            if (elements.panel.dataset.hiding === 'true') return;
            elements.panel.dataset.hiding = 'true';

            let settled = false;
            const finishHide = () => {
                if (settled) return;
                settled = true;
                elements.panel.style.display = 'none';
                elements.panel.classList.add('hidden');
                elements.panel.style.pointerEvents = 'none'; // extra safety: never intercept clicks while hidden
                elements.panel.removeEventListener('transitionend', onTransitionEnd);
                elements.panel.dataset.hiding = 'false';
            };

            const onTransitionEnd = (event) => {
                if (event.target !== elements.panel) return;
                finishHide();
            };

            elements.panel.addEventListener('transitionend', onTransitionEnd);

            // Fallback: if .collab-share-panel has no transition of its own
            // (only its children - overlay/modal - animate), transitionend
            // will never fire on the panel itself. Force-hide after the
            // known animation duration so it never gets stuck blocking clicks.
            setTimeout(finishHide, MODAL_ANIMATION_MS + 40);
        }
    };

    const loadState = () => {
        const saved = loadSavedState();
        state.userName = saved.userName;
        state.history = saved.history;

        if (saved.profile) {
            state.profileImage = saved.profile.profileImage || null;
            state.profileEmoji = saved.profile.profileEmoji || '';
            state.profileBackground = saved.profile.profileBackground || '';
            state.profileBio = saved.profile.profileBio || '';
            state.profilePronouns = saved.profile.profilePronouns || '';
            state.profileDisplayName = saved.profile.profileDisplayName || '';
            state.hasProfile = !!(saved.profile.profileImage || (saved.profile.profileEmoji && saved.profile.profileBackground));
        }

        if (state.userName) {
            elements.nameInput.value = state.userName;
            elements.nextStepButton.disabled = false;
        }
        renderRoomCount();
        renderHistory();
        renderCurrentSession();
        updateWorkspaceMenuProfile();
    };

    const getProfileData = () => ({
        profileImage: state.profileImage,
        profileEmoji: state.profileEmoji,
        profileBackground: state.profileBackground,
        profileBio: state.profileBio,
        profilePronouns: state.profilePronouns,
        profileDisplayName: state.profileDisplayName
    });

    /**
     * Updates the avatar icon inside the "Your Profile" button in the workspace menu.
     * The button itself is always visible - the icon only appears once a profile exists.
     */
    const updateWorkspaceMenuProfile = () => {
        const profileButton = document.getElementById('workspace-menu-profile');
        const iconElement = document.getElementById('workspace-menu-profile-icon');
        if (!profileButton || !iconElement) return;

        iconElement.classList.remove('hidden');
        if (state.profileImage) {
            iconElement.style.background = `url(${state.profileImage}) center/cover no-repeat`;
            iconElement.innerHTML = '';
        } else if (state.profileEmoji) {
            iconElement.style.background = state.profileBackground || 'var(--theme-border)';
            iconElement.textContent = state.profileEmoji;
        } else {
            iconElement.style.background = 'var(--theme-border)';
            iconElement.innerHTML = PERSON_PLACEHOLDER_ICON;
        }

        renderProfileUploadPreview();
        renderProfileView();

        // Bind the click listener once - this button persists across renders.
        if (profileButton.dataset.bound !== 'true') {
            profileButton.dataset.bound = 'true';
            profileButton.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('workspace-menu:request-close', {
                    detail: { after: openWorkspaceMenuProfileModal }
                }));
            });
        }
    };

    // Renders the inline "view" profile landing page (avatar, name, bio,
    // pronouns, display name). Also writes the username into the delete step.
    const renderProfileView = () => {
        const avatarEl = document.getElementById('workspace-menu-profile-view-avatar');
        const nameEl = document.getElementById('workspace-menu-profile-view-name');
        const bioEl = document.getElementById('workspace-menu-profile-view-bio');
        const pronounsEl = document.getElementById('workspace-menu-profile-view-pronouns');
        const displayNameEl = document.getElementById('workspace-menu-profile-view-display-name');
        const deleteUsernameEl = document.getElementById('collab-share-profile-delete-username');

        const displayName = state.profileDisplayName?.trim() || state.userName?.trim() || 'Guest';
        if (nameEl) nameEl.textContent = displayName;
        if (deleteUsernameEl) deleteUsernameEl.textContent = displayName;

        if (avatarEl) {
            if (state.profileImage) {
                avatarEl.style.backgroundImage = `url(${state.profileImage})`;
                avatarEl.style.backgroundColor = '';
                avatarEl.innerHTML = '';
            } else if (state.profileEmoji) {
                avatarEl.style.backgroundImage = '';
                avatarEl.style.backgroundColor = state.profileBackground || 'var(--theme-border)';
                avatarEl.innerHTML = '';
                avatarEl.textContent = state.profileEmoji;
            } else {
                avatarEl.style.backgroundImage = '';
                avatarEl.style.backgroundColor = 'var(--theme-border)';
                avatarEl.textContent = '';
                avatarEl.innerHTML = PERSON_PLACEHOLDER_ICON;
            }
        }

        const applyField = (el, value, emptyText) => {
            if (!el) return;
            const trimmed = (value || '').trim();
            if (trimmed) {
                el.textContent = trimmed;
                el.classList.remove('workspace-menu-profile-view-field-empty');
            } else {
                el.textContent = emptyText;
                el.classList.add('workspace-menu-profile-view-field-empty');
            }
        };
        applyField(bioEl, state.profileBio, 'No bio yet');
        applyField(pronounsEl, state.profilePronouns, 'Not set');
        applyField(displayNameEl, state.profileDisplayName, 'Not set');
    };

    const renderProfileUploadPreview = () => {
        const preview = document.getElementById('collab-share-profile-preview');
        if (!preview) return;
        if (state.profileImage) {
            preview.innerHTML = `<img src="${state.profileImage}" alt="Profile preview" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            preview.classList.remove('is-placeholder');
        } else {
            preview.innerHTML = PERSON_PLACEHOLDER_ICON;
            preview.classList.add('is-placeholder');
        }
    };

    // Workspace menu profile modal (dedicated, separate from the popover)

    const isWorkspaceMenuProfileModalOpen = () => {
        const modal = document.getElementById('workspace-menu-view');
        return !!modal && modal.classList.contains('is-open');
    };

    const openWorkspaceMenuProfileModal = () => {
        const modalRoot = document.getElementById('workspace-menu-view-root');
        const panel = document.getElementById('workspace-menu-view-panel');
        const overlay = document.getElementById('workspace-menu-view-overlay');
        const modal = document.getElementById('workspace-menu-view');
        if (!modalRoot || !panel || !modal) return;

        // Always start on the view step when the modal opens.
        applyProfileStepImmediate('view');
        renderProfileView();

        modalRoot.classList.add('is-visible');
        panel.classList.add('is-visible');

        requestAnimationFrame(() => {
            overlay?.classList.add('is-visible');
            modal.classList.remove('is-closing');
            modal.classList.add('is-open');
        });
    };

    const closeWorkspaceMenuProfileModal = () => {
        const modalRoot = document.getElementById('workspace-menu-view-root');
        const panel = document.getElementById('workspace-menu-view-panel');
        const overlay = document.getElementById('workspace-menu-view-overlay');
        const modal = document.getElementById('workspace-menu-view');
        if (!modalRoot || !panel || !modal || !modal.classList.contains('is-open')) return;

        modal.classList.remove('is-open');
        modal.classList.add('is-closing');
        overlay?.classList.remove('is-visible');

        window.setTimeout(() => {
            modal.classList.remove('is-closing');
            panel.classList.remove('is-visible');
            modalRoot.classList.remove('is-visible');
            applyProfileStepImmediate('view');
        }, MODAL_ANIMATION_MS);
    };

    // Profile sync (autosave + realtime broadcast)

    const setProfileSyncStatus = (status) => {
        state.profileSyncStatus = status;
        const el = document.getElementById('collab-share-profile-sync-status');
        if (!el) return;
        const labelMap = {
            idle: '',
            syncing: 'Saving...',
            synced: 'Saved',
            unsaved: 'Not synced with the room',
            retrying: 'Retrying sync...'
        };
        el.textContent = labelMap[status] || '';
        el.dataset.status = status;
    };

    const buildProfileDiff = () => ({
        userId: state.sessionId,
        emoji: state.profileEmoji,
        background: state.profileBackground,
        image: state.profileImage,
        bio: state.profileBio,
        pronouns: state.profilePronouns,
        displayName: state.profileDisplayName
    });

    // Sends the diff over WebSocket (awareness of the currently-connected room) so other users see it in real time.
    // If not connected to any room, there's nothing to sync over the network (data is already saved locally).
    const broadcastProfileDiff = () => {
        const awareness = state.collabController?.provider?.awareness;
        if (!awareness) {
            setProfileSyncStatus('synced');
            return;
        }
        try {
            awareness.setLocalStateField('profile', buildProfileDiff());
            setProfileSyncStatus('synced');
            if (state.profileSyncRetryTimer) {
                clearTimeout(state.profileSyncRetryTimer);
                state.profileSyncRetryTimer = null;
            }
        } catch (err) {
            scheduleSyncRetry();
        }
    };

    const scheduleSyncRetry = () => {
        setProfileSyncStatus('unsaved');
        if (state.profileSyncRetryTimer) clearTimeout(state.profileSyncRetryTimer);
        state.profileSyncRetryTimer = setTimeout(() => {
            setProfileSyncStatus('retrying');
            broadcastProfileDiff();
        }, SYNC_RETRY_DELAY);
    };

    // Optimistic UI: update locally right away + persist to Local Storage immediately,
    // then debounce before sending to the Collab Server over WebSocket.
    const scheduleProfileAutosave = () => {
        persistState({ userName: state.userName, history: state.history, profile: getProfileData() });
        updateWorkspaceMenuProfile();

        setProfileSyncStatus(state.collabController ? 'syncing' : 'synced');

        if (state.profileSyncTimer) clearTimeout(state.profileSyncTimer);
        state.profileSyncTimer = setTimeout(() => {
            broadcastProfileDiff();
        }, AUTO_SAVE_DELAY);
    };

    const renderRoomCount = () => {
        const activeCount = state.history.filter((item) => item.status === 'active').length;
        elements.roomCount.textContent = `${activeCount}/${ROOM_LIMIT} rooms`;
        const isFull = activeCount >= ROOM_LIMIT;
        elements.createRoomButton.disabled = isFull || !elements.roomNameInput.value.trim();
        elements.createError.textContent = isFull ? 'You can create up to 3 rooms at a time. Please close an old room first.' : '';
        elements.manageRoomsButton.classList.toggle('hidden', !isFull);
    };

    const renderHistory = () => {
        const list = state.history.slice(0, 8);
        elements.historySummary.textContent = `${list.length} ${list.length <= 1 ? 'Room' : 'Rooms'}`;
        elements.historyList.innerHTML = list.map(buildHistoryItemMarkup).join('');
        attachHistorySwipeHandlers();
    };

    const removeHistoryItem = async (roomCode) => {
        state.history = state.history.filter((entry) => entry.roomCode !== roomCode);
        persistState({ userName: state.userName, history: state.history, profile: getProfileData() });
        renderHistory();
        renderCurrentSession();
    };

    // Animates a history row collapsing (height + opacity) before it's actually
    // removed from state — used by both the flick-to-delete gesture and the
    // delete button revealed behind a card on a slower swipe.
    const animateRemoveHistoryRow = (wrapEl, roomCode) => {
        if (!wrapEl) {
            removeHistoryItem(roomCode);
            return;
        }
        wrapEl.style.transition = 'max-height 220ms ease, opacity 220ms ease, margin 220ms ease';
        wrapEl.style.maxHeight = `${wrapEl.offsetHeight}px`;
        requestAnimationFrame(() => {
            wrapEl.style.maxHeight = '0px';
            wrapEl.style.opacity = '0';
            wrapEl.style.marginBottom = '0px';
        });
        wrapEl.addEventListener('transitionend', () => {
            removeHistoryItem(roomCode);
        }, { once: true });
    };

    // Swipe-to-delete via Hammer.js Pan recognizer. Drag either direction to
    // reveal the delete button behind the card; a fast flick past the
    // halfway point deletes immediately without needing to tap the button.
    const attachHistorySwipeHandlers = () => {
        const cards = elements.historyList.querySelectorAll('.collab-share-history-item');

        cards.forEach((card) => {
            const wrap = card.closest('.collab-share-history-item-wrap');
            const roomCode = card.dataset.roomCode;
            let openX = 0; // where the card currently rests: 0 closed, ±OFFSET open

            const mc = new Hammer.Manager(card);
            mc.add(new Hammer.Pan({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 4 }));

            mc.on('panstart', () => {
                card.style.transition = 'none';
            });

            mc.on('panmove', (event) => {
                const next = Math.max(-SWIPE_MAX_DRAG, Math.min(SWIPE_MAX_DRAG, openX + event.deltaX));
                card.style.transform = `translateX(${next}px)`;
            });

            mc.on('panend', (event) => {
                card.style.transition = 'transform 200ms ease';
                const finalX = Math.max(-SWIPE_MAX_DRAG, Math.min(SWIPE_MAX_DRAG, openX + event.deltaX));
                const fastFlick = Math.abs(event.velocityX) >= SWIPE_DELETE_VELOCITY;

                if (fastFlick && Math.abs(finalX) >= SWIPE_OPEN_OFFSET / 2) {
                    const direction = event.deltaX > 0 ? 1 : -1;
                    card.style.transform = `translateX(${direction * 400}px)`;
                    card.style.opacity = '0';
                    animateRemoveHistoryRow(wrap, roomCode);
                    return;
                }

                if (Math.abs(finalX) >= SWIPE_OPEN_OFFSET / 2) {
                    openX = finalX > 0 ? SWIPE_OPEN_OFFSET : -SWIPE_OPEN_OFFSET;
                } else {
                    openX = 0;
                }
                card.style.transform = `translateX(${openX}px)`;
            });
        });
    };

    const renderCurrentSession = () => {
        if (!state.activeSession) {
            elements.sidebarRoomLabel.textContent = '';
            elements.currentSession.innerHTML = createCurrentSessionMarkup(null);
            elements.currentSession.classList.add('hidden');
            return;
        }

        elements.sidebarRoomLabel.textContent = `${state.activeSession.roomName || `Room ${state.activeSession.roomCode}`}`;
        elements.currentSession.innerHTML = createCurrentSessionMarkup(state.activeSession);
        elements.currentSession.classList.remove('hidden');
        const copyButton = document.getElementById('collab-share-copy-room-code');
        const leaveButton = document.getElementById('collab-share-leave-room');

        const participantsListEl = document.getElementById('collab-share-participants-list');
        const participantsCountEl = document.getElementById('collab-share-participants-count');
        const syncIndicatorEl = document.getElementById('collab-share-sync-indicator');
        try {
            const awareness = state.collabController?.provider?.awareness;
            const states = awareness ? Array.from(awareness.getStates().values()) : [];
            const participants = states.map((s, idx) => {
                const name = s.userName || s.name || `User ${idx + 1}`;
                const sid = s.sessionId || s.session || `s-${idx}`;
                const role = (state.activeSession && state.activeSession.isCreator && sid === state.sessionId) ? 'Owner' : (s.role || 'Editor');
                return { name, sid, role };
            });
            if (participantsCountEl) participantsCountEl.textContent = `${participants.length} people`;
            if (participantsListEl) {
                participantsListEl.innerHTML = participants.map((p) => `<div class="collab-share-participant"><strong>${p.name}</strong> <span class="collab-share-participant-role">${p.role}</span></div>`).join('');
            }
            if (syncIndicatorEl) syncIndicatorEl.textContent = state.connectionState === 'connected' ? 'Synced' : (state.connectionState === 'disconnected' ? 'Reconnecting...' : 'Syncing...');
        } catch (e) {
            // ignore
        }

        if (copyButton) {
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(state.activeSession.roomCode).then(() => {
                    showToast('Room code copied');
                }).catch(() => {
                    showToast('Copy failed');
                });
            });
        }

        if (leaveButton) {
            leaveButton.addEventListener('click', async () => {
                await closeActiveSession();
                openSidebar({ returnTo: 'background' });
            });
        }
    };

    const showToast = (message, type = 'default') => {
        if (!elements.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `collab-share-toast collab-share-toast-${type}`;
        toast.textContent = message;
        elements.toastContainer.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => {
                toast.remove();
            }, 220);
        }, 2600);
    };

    const startHeartbeat = () => {
        stopHeartbeat();
        state.heartbeatInterval = setInterval(() => {
            try {
                state.collabController?.sendHeartbeat?.({ sessionId: state.sessionId });
            } catch (e) {
                // ignore
            }
        }, 7000);
    };

    const stopHeartbeat = () => {
        if (state.heartbeatInterval) {
            clearInterval(state.heartbeatInterval);
            state.heartbeatInterval = null;
        }
    };

    const enterOwnerGrace = () => {
        if (!state.activeSession) return;
        const remaining = GRACE_PERIOD_MS;
        showToast(`Owner lost. Closing in ${Math.ceil(remaining / 1000)}s`, 'warning');
        if (state.ownerGraceTimer) clearTimeout(state.ownerGraceTimer);
        state.ownerGraceTimer = setTimeout(async () => {
            if (!state.activeSession) return;
            await closeActiveSession();
            showToast('Owner left. Room closed', 'warning');
        }, GRACE_PERIOD_MS);
    };

    const leaveOwnerGrace = () => {
        if (state.ownerGraceTimer) {
            clearTimeout(state.ownerGraceTimer);
            state.ownerGraceTimer = null;
            showToast('Owner resumed');
        }
    };

    const resetOtpInputs = () => {
        Array.from({ length: ROOM_CODE_LENGTH }).forEach((_, index) => {
            const input = document.getElementById(`collab-share-otp-${index}`);
            if (input) input.value = '';
        });
    };

    const slideModalOut = () => new Promise((resolve) => {
        if (!elements.modal.classList.contains('is-open')) {
            resolve();
            return;
        }

        state.isModalAnimating = true;
        elements.modal.classList.remove('is-open');
        elements.modal.classList.add('is-closing');
        window.setTimeout(() => {
            elements.modal.classList.remove('is-closing');
            state.isModalAnimating = false;
            resolve();
        }, MODAL_ANIMATION_MS);
    });

    const slideModalIn = () => {
        state.isModalAnimating = true;
        elements.modal.classList.remove('is-closing', 'is-open');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                elements.modal.classList.add('is-open');
            });
        });
        window.setTimeout(() => {
            state.isModalAnimating = false;
        }, MODAL_ANIMATION_MS);
    };

    const slideSidebarIn = () => {
        elements.sidebar.classList.remove('hidden', 'is-closing', 'is-open');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                elements.sidebar.classList.add('is-open');
            });
        });
        renderHistory();
        renderCurrentSession();
    };

    const slideSidebarOut = () => new Promise((resolve) => {
        if (elements.sidebar.classList.contains('hidden') || !elements.sidebar.classList.contains('is-open')) {
            elements.sidebar.classList.add('hidden');
            elements.sidebar.classList.remove('is-closing', 'is-open');
            resolve();
            return;
        }

        elements.sidebar.classList.remove('is-open');
        elements.sidebar.classList.add('is-closing');
        window.setTimeout(() => {
            elements.sidebar.classList.add('hidden');
            elements.sidebar.classList.remove('is-closing', 'is-open');
            resolve();
        }, MODAL_ANIMATION_MS);
    });

    const openModal = () => {
        if (state.isModalAnimating) return;
        state.isModalAnimating = true;

        setRootVisible(true);
        setPanelVisible(true);
        elements.sidebar.classList.add('hidden');
        elements.sidebar.classList.remove('is-closing', 'is-open');

        state.modalHistory = [];

        // Profile setup is no longer part of this flow - jump straight to the action
        // step if we already have a name, otherwise ask for one first.
        const initialStep = state.userName ? 'collab-share-step-action' : 'collab-share-step-welcome';
        applyStepImmediate(initialStep);

        elements.modal.classList.remove('is-closing', 'is-open');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                elements.modal.classList.add('is-open');
            });
        });

        window.setTimeout(() => {
            state.isModalAnimating = false;
        }, MODAL_ANIMATION_MS);
    };

    const closeModal = () => {
        if (state.isModalAnimating || !elements.modal.classList.contains('is-open')) return;
        state.isModalAnimating = true;

        elements.modal.classList.remove('is-open');
        elements.modal.classList.add('is-closing');
        elements.overlay?.classList.remove('is-visible');

        window.setTimeout(() => {
            elements.modal.classList.remove('is-closing');
            setPanelVisible(false);
            if (!state.activeSession) {
                setRootVisible(false);
            }
            state.isModalAnimating = false;
        }, MODAL_ANIMATION_MS);
    };

    // Closes whatever overlay is currently topmost (crop tool > workspace-menu profile panel > modal > sidebar).
    // Used by the ESC key.
    const closeTopmostOverlay = () => {
        const cropContainer = document.getElementById('collab-share-crop-container');
        if (cropContainer && !cropContainer.classList.contains('hidden')) {
            cancelCrop();
            return;
        }
        if (isWorkspaceMenuProfileModalOpen()) {
            closeWorkspaceMenuProfileModal();
            return;
        }
        if (elements.sidebar && !elements.sidebar.classList.contains('hidden') && elements.sidebar.classList.contains('is-open')) {
            goBackFromSidebar();
            return;
        }
        if (elements.modal && elements.modal.classList.contains('is-open')) {
            closeModal();
        }
    };

    const handleGlobalKeydown = (event) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
            closeTopmostOverlay();
        }
    };

    const openSidebar = async ({ returnTo = 'background' } = {}) => {
        if (state.isModalAnimating) return;

        state.sidebarReturnTo = returnTo;
        setRootVisible(true);
        setPanelVisible(true);

        await slideModalOut();
        slideSidebarIn();
    };

    const goBackFromSidebar = async () => {
        if (state.isModalAnimating) return;

        const returnTo = state.sidebarReturnTo;
        state.sidebarReturnTo = null;

        await slideSidebarOut();

        if (returnTo === 'modal') {
            slideModalIn();
        } else {
            minimizePanel();
        }
    };

    const minimizePanel = () => {
        elements.modal.classList.remove('is-open', 'is-closing');
        elements.sidebar.classList.add('hidden');
        elements.sidebar.classList.remove('is-closing', 'is-open');
        elements.overlay?.classList.remove('is-visible');
        setPanelVisible(false);
        if (state.activeSession) {
            setRootVisible(true);
        } else {
            setRootVisible(false);
        }
        updateShareBadge(state.activeSession ? state.activeSession.participants : 0);
    };

    const updateShareBadge = (count) => {
        const badge = elements.minimizedBadge;
        if (!badge) return;
        if (count > 0) {
            badge.textContent = String(count);
            badge.classList.remove('hidden');
        } else {
            badge.textContent = '';
            badge.classList.add('hidden');
        }
    };

    const cleanupController = () => {
        if (state.presenceInterval) {
            clearInterval(state.presenceInterval);
            state.presenceInterval = null;
        }
        if (state.reconnectTimeout) {
            clearTimeout(state.reconnectTimeout);
            state.reconnectTimeout = null;
        }
        stopHeartbeat();
        leaveOwnerGrace();
        if (state.collabController) {
            try {
                state.collabController.destroy();
            } catch (e) {
                // ignore
            }
            state.collabController = null;
        }
    };

    const updatePresenceState = () => {
        if (!state.collabController?.provider?.awareness) {
            return;
        }
        const count = state.collabController.provider.awareness.getStates().size;
        if (state.activeSession) {
            state.activeSession.participants = count;
            state.activeSession.lastActiveAt = Date.now();
            renderCurrentSession();
            renderHistory();
            updateShareBadge(count);
        }
    };

    const connectToRoom = async ({ roomCode, roomName, isCreator = false, requestId = null } = {}) => {
        if (!editorElement) {
            throw new Error('Editor element not found');
        }

        if (!ROOM_CODE_REGEX.test(roomCode)) {
            throw new Error('Invalid code format');
        }

        if (state.activeSession?.roomCode === roomCode) {
            throw new Error('You\'re already in this room');
        }

        const name = state.userName || 'Guest';
        state.userColor = state.userColor || `hsl(${Math.floor(Math.random() * 360)}, 75%, 55%)`;

        cleanupController();

        const controller = initRealtimeCollab(editorElement, {
            serverUrl: config?.collab?.serverUrl,
            room: roomCode,
            mapName: config?.collab?.mapName,
            debounceMs: config?.collab?.debounceMs,
            connectionTimeoutMs: config?.collab?.connectionTimeoutMs,
            autoDisableOnFail: false,
            userName: name,
            userColor: state.userColor,
            sessionId: state.sessionId,
            requestId: requestId || null
        });

        state.collabController = controller;
        const provider = controller.provider;

        // Publish the current profile into awareness as soon as we connect, so others see it.
        try {
            provider?.awareness?.setLocalStateField('profile', buildProfileDiff());
        } catch (e) {
            // ignore
        }

        let resolved = false;

        const waitForConnection = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (resolved) return;
                resolved = true;
                reject(new Error('Unable to connect to the server'));
            }, 4500);

            if (!provider || typeof provider.on !== 'function') {
                clearTimeout(timeout);
                return reject(new Error('Connection is not supported'));
            }

            const handleStatus = ({ status }) => {
                if (status === 'connected') {
                    if (resolved) return;
                    resolved = true;
                    clearTimeout(timeout);
                    provider.off('status', handleStatus);
                    resolve(controller);
                }

                if (status === 'disconnected' && !resolved) {
                    // keep waiting until timeout, some reconnects happen automatically
                }
            };

            provider.on('status', handleStatus);
        });

        try {
            await waitForConnection;
        } catch (err) {
            cleanupController();
            const raw = err || {};
            const code = raw.code || String(raw.message || '').toUpperCase();
            let message = 'Unable to connect to the server';
            if (code.includes('ROOM_FULL')) message = 'This room is full';
            else if (code.includes('ROOM_NOT_FOUND') || code.includes('NOT_FOUND')) message = 'Room not found. Please check the code again';
            else if (code.includes('ROOM_CLOSED') || code.includes('ROOM_EXPIRED')) message = 'This room is closed or has expired';
            throw new Error(message);
        }

        state.activeSession = {
            id: Date.now(),
            roomCode,
            roomName: roomName || `Room ${roomCode}`,
            status: 'active',
            participants: 1,
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
            isCreator
        };

        if (isCreator) {
            startHeartbeat();
        }

        state.history = [state.activeSession, ...state.history.filter((item) => item.roomCode !== roomCode)];
        persistState({ userName: state.userName, history: state.history, profile: getProfileData() });

        if (state.presenceInterval) {
            clearInterval(state.presenceInterval);
        }
        state.presenceInterval = setInterval(updatePresenceState, 1800);

        provider.on('status', ({ status }) => {
            if (status === 'connected') {
                if (isCreator) leaveOwnerGrace();
                showToast('Done');
                state.connectionState = 'connected';
                setProfileSyncStatus('synced');
            }
            if (status === 'disconnected') {
                if (isCreator) enterOwnerGrace();
                state.connectionState = 'disconnected';
                // showToast('Lost, Retry', 'warning');
                if (state.reconnectTimeout) {
                    clearTimeout(state.reconnectTimeout);
                }
                state.reconnectTimeout = window.setTimeout(async () => {
                    if (state.connectionState !== 'connected') {
                        await closeActiveSession();
                        showToast('Reconnect failed. Restarting', 'warning');
                        openModal();
                    }
                }, 8000);
            }
        });

        updatePresenceState();
        renderCurrentSession();
        renderHistory();
        updateShareBadge(1);
        emitSessionChange(true);
    };

    const closeActiveSession = async () => {
        if (!state.activeSession) return;
        stopHeartbeat();
        leaveOwnerGrace();

        state.activeSession.status = 'closed';
        state.activeSession.participants = 0;
        state.activeSession.lastActiveAt = Date.now();
        renderHistory();
        renderCurrentSession();
        persistState({ userName: state.userName, history: state.history, profile: getProfileData() });
        cleanupController();
        state.activeSession = null;
        updateShareBadge(0);
        emitSessionChange(false);
    };

    const handleHistoryAction = async (event) => {
        const target = /** @type {HTMLElement} */ (event.target);
        const action = target.dataset.action;
        const roomCode = target.dataset.roomCode;
        if (!action || !roomCode) return;

        if (action === 'rejoin') {
            const item = state.history.find((entry) => entry.roomCode === roomCode);
            if (!item) return;
            if (state.activeSession?.roomCode === roomCode) {
                showToast('You\'re already in this room');
                return;
            }
            try {
                await connectToRoom({ roomCode: item.roomCode, roomName: item.roomName, isCreator: item.isCreator });
                minimizePanel();
            } catch (error) {
                elements.otpError.textContent = String(error.message || 'Unable to join');
            }
        }

        if (action === 'close') {
            const item = state.history.find((entry) => entry.roomCode === roomCode);
            if (!item) return;
            item.status = 'closed';
            item.participants = 0;
            persistState({ userName: state.userName, history: state.history, profile: getProfileData() });
            renderHistory();
            renderCurrentSession();
            showToast('Room closed');
        }

        if (action === 'delete') {
            const wrap = target.closest('.collab-share-history-item-wrap');
            animateRemoveHistoryRow(wrap, roomCode);
        }
    };

    const resetCreateStep = () => {
        elements.roomNameInput.value = '';
        elements.createRoomButton.disabled = true;
        elements.createError.textContent = '';
        elements.manageRoomsButton.classList.add('hidden');
    };

    const prepareJoinStep = () => {
        resetOtpInputs();
        elements.otpError.textContent = '';
    };

    const validateJoinCode = async () => {
        const code = getJoinCode();
        if (!ROOM_CODE_REGEX.test(code)) {
            return;
        }
        elements.otpError.textContent = '';
        showToast('Verifying...', 'default');

        try {
            await connectToRoom({ roomCode: code, roomName: `Room ${code}`, isCreator: false });
            minimizePanel();
        } catch (error) {
            elements.otpError.textContent = String(error.message || 'Room not found or invalid code');
            const otpInputs = Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => document.getElementById(`collab-share-otp-${index}`));
            otpInputs.forEach((input) => input?.classList.add('shake'));
            window.setTimeout(() => {
                otpInputs.forEach((input) => input?.classList.remove('shake'));
            }, 420);
        }
    };

    const attachOtpHandlers = () => {
        const inputs = Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => document.getElementById(`collab-share-otp-${index}`));

        inputs.forEach((input, index) => {
            if (!input) return;
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Backspace' && input.value === '' && index > 0) {
                    const prev = inputs[index - 1];
                    prev?.focus();
                }
            });

            input.addEventListener('input', (event) => {
                const value = (event.target.value || '').replace(/\D/g, '');
                input.value = value;

                if (value && index < inputs.length - 1) {
                    const next = inputs[index + 1];
                    next?.focus();
                }

                const code = getJoinCode();
                if (code.length === ROOM_CODE_LENGTH) {
                    validateJoinCode();
                }
            });

            input.addEventListener('paste', (event) => {
                event.preventDefault();
                const paste = event.clipboardData?.getData('text/plain') || '';
                const digits = paste.replace(/\D/g, '').slice(0, ROOM_CODE_LENGTH).split('');
                digits.forEach((digit, position) => {
                    const target = inputs[position];
                    if (target) target.value = digit;
                });
                const next = inputs[digits.length - 1];
                next?.focus();
                if (digits.length === ROOM_CODE_LENGTH) {
                    validateJoinCode();
                }
            });
        });
    };

    const handleUserNameInput = () => {
        const value = sanitizeUserName(elements.nameInput.value);
        elements.nameError.textContent = isValidUserName(value) ? '' : 'Please enter a valid name (no special characters)';
        elements.nextStepButton.disabled = !isValidUserName(value);
    };

    // Crop tool

    const resetCropTransform = () => {
        state.cropScale = 1;
        state.cropOffsetX = 0;
        state.cropOffsetY = 0;
        state.cropHistory = [];
        state.cropFuture = [];
        const zoomInput = document.getElementById('collab-share-crop-zoom');
        if (zoomInput) zoomInput.value = '1';
        applyCropTransform();
        updateCropHistoryButtons();
    };

    const captureCropSnapshot = () => ({
        scale: state.cropScale,
        offsetX: state.cropOffsetX,
        offsetY: state.cropOffsetY
    });

    const applyCropSnapshot = (snapshot) => {
        if (!snapshot) return;
        state.cropScale = snapshot.scale;
        state.cropOffsetX = snapshot.offsetX;
        state.cropOffsetY = snapshot.offsetY;
        const zoomInput = document.getElementById('collab-share-crop-zoom');
        if (zoomInput) zoomInput.value = String(snapshot.scale);
        applyCropTransform();
    };

    const updateCropHistoryButtons = () => {
        const undoBtn = document.getElementById('collab-share-crop-undo');
        const redoBtn = document.getElementById('collab-share-crop-redo');
        if (undoBtn) undoBtn.disabled = state.cropHistory.length === 0;
        if (redoBtn) redoBtn.disabled = state.cropFuture.length === 0;
    };

    const undoCropChange = () => {
        if (state.cropHistory.length === 0) return;
        const previous = state.cropHistory.pop();
        state.cropFuture.push(captureCropSnapshot());
        applyCropSnapshot(previous);
        updateCropHistoryButtons();
    };

    const redoCropChange = () => {
        if (state.cropFuture.length === 0) return;
        const next = state.cropFuture.pop();
        state.cropHistory.push(captureCropSnapshot());
        applyCropSnapshot(next);
        updateCropHistoryButtons();
    };

    // Push the *previous* transform onto the history stack whenever a new
    // change begins (dragging = a single gesture, not every pointermove tick).
    const pushCropHistory = () => {
        state.cropHistory.push(captureCropSnapshot());
        if (state.cropHistory.length > 50) {
            state.cropHistory.shift();
        }
        state.cropFuture = [];
        updateCropHistoryButtons();
    };

    const getCropBaseCover = () => {
        if (!state.cropNaturalWidth || !state.cropNaturalHeight) return 1;
        return CROP_VIEWPORT_SIZE / Math.min(state.cropNaturalWidth, state.cropNaturalHeight);
    };

    const clampCropOffsets = () => {
        const baseCover = getCropBaseCover();
        const effectiveScale = baseCover * state.cropScale;
        const displayWidth = state.cropNaturalWidth * effectiveScale;
        const displayHeight = state.cropNaturalHeight * effectiveScale;
        const maxOffsetX = Math.max(0, (displayWidth - CROP_VIEWPORT_SIZE) / 2);
        const maxOffsetY = Math.max(0, (displayHeight - CROP_VIEWPORT_SIZE) / 2);
        state.cropOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, state.cropOffsetX));
        state.cropOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, state.cropOffsetY));
    };

    const applyCropTransform = () => {
        if (!state.cropImageEl) return;
        clampCropOffsets();
        const baseCover = getCropBaseCover();
        const effectiveScale = baseCover * state.cropScale;
        state.cropImageEl.style.width = `${state.cropNaturalWidth * effectiveScale}px`;
        state.cropImageEl.style.height = `${state.cropNaturalHeight * effectiveScale}px`;
        state.cropImageEl.style.transform = `translate(-50%, -50%) translate(${state.cropOffsetX}px, ${state.cropOffsetY}px)`;
    };

    const openCropTool = (dataUrl) => {
        const cropContainer = document.getElementById('collab-share-crop-container');
        const cropImage = document.getElementById('collab-share-crop-image');
        const previewContainer = document.getElementById('collab-share-profile-preview-container');
        if (!cropContainer || !cropImage) return;

        state.cropImageEl = cropImage;
        cropImage.onload = () => {
            state.cropNaturalWidth = cropImage.naturalWidth;
            state.cropNaturalHeight = cropImage.naturalHeight;
            resetCropTransform();
        };
        cropImage.src = dataUrl;

        cropContainer.classList.remove('hidden');
        previewContainer?.classList.add('hidden');
    };

    const cancelCrop = () => {
        const cropContainer = document.getElementById('collab-share-crop-container');
        const previewContainer = document.getElementById('collab-share-profile-preview-container');
        const imageInput = document.getElementById('collab-share-profile-image-input');
        cropContainer?.classList.add('hidden');
        previewContainer?.classList.remove('hidden');
        if (imageInput) imageInput.value = '';
        state.cropImageEl = null;
    };

    const confirmCrop = () => {
        if (!state.cropImageEl || !state.cropNaturalWidth || !state.cropNaturalHeight) return;

        const previewContainer = document.getElementById('collab-share-profile-preview-container');

        const baseCover = getCropBaseCover();
        const effectiveScale = baseCover * state.cropScale;
        const displayWidth = state.cropNaturalWidth * effectiveScale;
        const displayHeight = state.cropNaturalHeight * effectiveScale;

        // Center point of the viewport frame, relative to the source image pixels.
        const sourceX = ((displayWidth - CROP_VIEWPORT_SIZE) / 2 - state.cropOffsetX) / effectiveScale;
        const sourceY = ((displayHeight - CROP_VIEWPORT_SIZE) / 2 - state.cropOffsetY) / effectiveScale;
        const sourceSize = CROP_VIEWPORT_SIZE / effectiveScale;

        const canvas = document.createElement('canvas');
        canvas.width = CROP_OUTPUT_SIZE;
        canvas.height = CROP_OUTPUT_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
            state.cropImageEl,
            Math.max(0, sourceX),
            Math.max(0, sourceY),
            Math.min(sourceSize, state.cropNaturalWidth),
            Math.min(sourceSize, state.cropNaturalHeight),
            0,
            0,
            CROP_OUTPUT_SIZE,
            CROP_OUTPUT_SIZE
        );

        const croppedDataUrl = canvas.toDataURL('image/png');

        state.profileImage = croppedDataUrl;
        state.profileEmoji = '';
        state.profileBackground = '';
        state.hasProfile = true;

        scheduleProfileAutosave();

        // const previewContainer = document.getElementById('collab-share-profile-preview-container');
        // const preview = document.getElementById('collab-share-profile-preview');
        // if (preview) {
        //     preview.innerHTML = `<img src="${croppedDataUrl}" alt="Profile preview" style="width:100px;height:100px;object-fit:cover;border-radius:50%;">`;
        // }

        const cropContainer = document.getElementById('collab-share-crop-container');
        cropContainer?.classList.add('hidden');
        previewContainer?.classList.remove('hidden');

        showToast('Profile photo saved');
    };

    const attachCropDragHandlers = () => {
        const viewport = document.getElementById('collab-share-crop-viewport');
        if (!viewport) return;

        const onPointerDown = (event) => {
            state.cropDragging = true;
            state.cropDragStartX = event.clientX;
            state.cropDragStartY = event.clientY;
            state.cropDragOriginX = state.cropOffsetX;
            state.cropDragOriginY = state.cropOffsetY;
            // Snapshot the transform BEFORE this drag gesture starts so undo
            // restores to where the image was before the drag began.
            pushCropHistory();
            viewport.setPointerCapture?.(event.pointerId);
        };

        const onPointerMove = (event) => {
            if (!state.cropDragging) return;
            state.cropOffsetX = state.cropDragOriginX + (event.clientX - state.cropDragStartX);
            state.cropOffsetY = state.cropDragOriginY + (event.clientY - state.cropDragStartY);
            applyCropTransform();
        };

        const onPointerUp = () => {
            state.cropDragging = false;
        };

        viewport.addEventListener('pointerdown', onPointerDown);
        viewport.addEventListener('pointermove', onPointerMove);
        viewport.addEventListener('pointerup', onPointerUp);
        viewport.addEventListener('pointercancel', onPointerUp);

        const zoomInput = document.getElementById('collab-share-crop-zoom');
        zoomInput?.addEventListener('input', (event) => {
            // Slider is treated as one continuous gesture; only the first tick
            // of a new drag captures the previous transform.
            if (!zoomInput.dataset.historyPushed) {
                pushCropHistory();
                zoomInput.dataset.historyPushed = 'true';
            }
            state.cropScale = Number(event.target.value) || 1;
            applyCropTransform();
        });
        zoomInput?.addEventListener('change', () => {
            zoomInput.dataset.historyPushed = '';
        });

        document.getElementById('collab-share-crop-undo')?.addEventListener('click', undoCropChange);
        document.getElementById('collab-share-crop-redo')?.addEventListener('click', redoCropChange);
    };

    // Custom profile step: Emoji/Background color accordion, only one open at a time
    const bindProfileCustomAccordion = () => {
        const group = document.querySelector('#wm-profile-step-custom [data-accordion-group]');
        if (!group || group.dataset.bound === 'true') return;
        group.dataset.bound = 'true';

        group.addEventListener('click', (event) => {
            const toggle = event.target.closest('[data-accordion-toggle]');
            if (!toggle) return;

            const item = toggle.closest('[data-accordion-item]');
            const willOpen = !item.classList.contains('is-open');

            group.querySelectorAll('[data-accordion-item]').forEach((el) => {
                el.classList.remove('is-open');
                el.querySelector('[data-accordion-toggle]')?.setAttribute('aria-expanded', 'false');
            });

            if (willOpen) {
                item.classList.add('is-open');
                toggle.setAttribute('aria-expanded', 'true');
            }
        });
    };

    // "Wave" hover: nearby swatches scale down
    const bindColorSwatchWave = () => {
        const grid = document.getElementById('collab-share-color-grid');
        if (!grid || grid.dataset.waveBound === 'true') return;
        grid.dataset.waveBound = 'true';

        const swatches = Array.from(grid.querySelectorAll('.collab-share-color-swatch'));
        const columns = 5; // grid-template-columns count

        const resetWave = () => {
            swatches.forEach((el) => el.style.removeProperty('--wave-scale'));
        };

        swatches.forEach((el, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;

            el.addEventListener('mouseenter', () => {
                swatches.forEach((target, targetIndex) => {
                    const targetRow = Math.floor(targetIndex / columns);
                    const targetCol = targetIndex % columns;
                    const distance = Math.hypot(targetRow - row, targetCol - col);

                    // Falloff curve: hovered = 1.5x, then decays smoothly to 1x within ~2 cells
                    const scale = Math.max(1, 1.5 - distance * 0.28);
                    target.style.setProperty('--wave-scale', scale.toFixed(3));
                });
            });
        });

        grid.addEventListener('mouseleave', resetWave);
    };

    // Pulls the current profile emoji/background into the hidden inputs and
    // refreshes selection styling before the user opens the custom step.
    const hydrateCustomProfileInputs = () => {
        const emojiInput = document.getElementById('collab-share-profile-emoji-input');
        const colorInput = document.getElementById('collab-share-profile-color-input');
        const emojiGrid = document.getElementById('collab-share-emoji-grid');
        const colorGrid = document.getElementById('collab-share-color-grid');
        if (emojiInput) emojiInput.value = state.profileEmoji || '';
        if (colorInput) colorInput.value = state.profileBackground || '#e5cdcd';

        const accordionItems = document.querySelectorAll('#wm-profile-step-custom [data-accordion-item]');
        accordionItems.forEach((item) => {
            const isEmoji = item.dataset.accordionItem === 'emoji';
            item.classList.toggle('is-open', isEmoji);
            item.querySelector('[data-accordion-toggle]')?.setAttribute('aria-expanded', isEmoji ? 'true' : 'false');
        });

        if (emojiGrid) {
            const selected = emojiInput?.value || '';
            emojiGrid.querySelectorAll('.collab-share-emoji-option').forEach((btn) => {
                const isMatch = btn.dataset.emoji === selected;
                btn.classList.toggle('is-selected', isMatch);
                btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
            });
        }
        if (colorGrid) {
            const selected = (colorInput?.value || '').toLowerCase();
            colorGrid.querySelectorAll('.collab-share-color-swatch').forEach((btn) => {
                const isMatch = (btn.dataset.color || '').toLowerCase() === selected;
                btn.classList.toggle('is-selected', isMatch);
                btn.setAttribute('aria-checked', isMatch ? 'true' : 'false');
            });
        }
        const customPreview = document.getElementById('collab-share-profile-preview-custom');
        if (customPreview) {
            customPreview.style.background = colorInput?.value || '#e5cdcd';
            customPreview.textContent = emojiInput?.value || '';
        }
    };

    // Pulls the current Bio / Pronouns / Display Name into the textarea+inputs
    // before the user opens the details step.
    const hydrateDetailsInputs = () => {
        const bioEl = document.getElementById('collab-share-profile-bio-input');
        const pronounsEl = document.getElementById('collab-share-profile-pronouns-input');
        const displayNameEl = document.getElementById('collab-share-profile-display-name-input');
        if (bioEl) bioEl.value = state.profileBio || '';
        if (pronounsEl) pronounsEl.value = state.profilePronouns || '';
        if (displayNameEl) displayNameEl.value = state.profileDisplayName || '';
    };

    // Listeners

    const initializeListeners = () => {
        elements.shareButton?.addEventListener('click', () => {
            if (state.activeSession) {
                openSidebar({ returnTo: 'background' });
            } else {
                openModal();
            }
        });

        elements.minimizedButton?.addEventListener('click', () => openSidebar({ returnTo: 'modal' }));
        elements.closeModal?.addEventListener('click', closeModal);
        elements.backButton?.addEventListener('click', goBackInModal);
        elements.sidebarBack?.addEventListener('click', goBackFromSidebar);
        elements.closeSidebar?.addEventListener('click', minimizePanel);
        elements.overlay?.addEventListener('click', () => {
            if (elements.sidebar.classList.contains('hidden')) {
                closeModal();
            } else {
                minimizePanel();
            }
        });

        // Close overlays with the ESC key (same behavior as the overlay/modal close buttons).
        document.addEventListener('keydown', handleGlobalKeydown);

        elements.nameInput?.addEventListener('input', handleUserNameInput);
        elements.nextStepButton?.addEventListener('click', () => {
            const nameValue = sanitizeUserName(elements.nameInput.value);
            if (!isValidUserName(nameValue)) {
                elements.nameError.textContent = 'Please enter a valid name';
                return;
            }
            state.userName = nameValue;
            persistState({ userName: state.userName, history: state.history, profile: getProfileData() });
            updateWorkspaceMenuProfile();

            setStep('collab-share-step-action', { direction: 'forward' });
        });

        elements.actionJoin?.addEventListener('click', () => {
            setStep('collab-share-step-join', { direction: 'forward' });
            prepareJoinStep();
        });

        elements.actionCreate?.addEventListener('click', () => {
            setStep('collab-share-step-create', { direction: 'forward' });
            elements.createError.textContent = '';
            elements.manageRoomsButton.classList.toggle('hidden', state.history.filter((item) => item.status === 'active').length < ROOM_LIMIT);
        });

        elements.roomNameInput?.addEventListener('input', () => {
            renderRoomCount();
            const value = sanitizeUserName(elements.roomNameInput.value);
            elements.createRoomButton.disabled = !value || state.history.filter((item) => item.status === 'active').length >= ROOM_LIMIT;
        });

        elements.createRoomButton?.addEventListener('click', async () => {
            const roomName = sanitizeUserName(elements.roomNameInput.value);
            const activeCount = state.history.filter((item) => item.status === 'active').length;
            if (!roomName) {
                elements.createError.textContent = 'Please name the room first';
                return;
            }
            if (activeCount >= ROOM_LIMIT) {
                elements.createError.textContent = 'You can create up to 3 rooms at a time. Please close an old room first.';
                return;
            }

            const requestId = uuidv4();
            state.pendingCreateRequestId = requestId;
            elements.createRoomButton.disabled = true;
            elements.createError.textContent = '';

            const roomCode = createRoomCode(state.history);
            try {
                await connectToRoom({ roomCode, roomName, isCreator: true, requestId });
                minimizePanel();
            } catch (error) {
                elements.createError.textContent = String(error.message || 'Failed to create room');
            } finally {
                state.pendingCreateRequestId = null;
                const stillFull = state.history.filter((item) => item.status === 'active').length >= ROOM_LIMIT;
                elements.createRoomButton.disabled = stillFull || Boolean(state.activeSession);
            }
        });

        elements.manageRoomsButton?.addEventListener('click', () => {
            openSidebar({ returnTo: 'modal' });
        });

        elements.historyList?.addEventListener('click', handleHistoryAction);

        // Workspace menu: close button / overlay click dismiss the dedicated profile modal.
        document.getElementById('workspace-menu-view-close')?.addEventListener('click', closeWorkspaceMenuProfileModal);
        document.getElementById('workspace-menu-view-overlay')?.addEventListener('click', closeWorkspaceMenuProfileModal);

        // Profile option selection (upload / custom / details / delete)
        document.querySelectorAll('.collab-share-profile-option').forEach((option) => {
            option.addEventListener('click', () => {
                const target = option.dataset.profileType;
                if (!target) return;
                if (target === 'details') {
                    hydrateDetailsInputs();
                }
                if (target === 'custom') {
                    hydrateCustomProfileInputs();
                }
                if (target === 'upload') {
                    renderProfileUploadPreview();
                }
                setProfileStep(target, { direction: 'forward' });
            });
        });

        // Back buttons - each carries data-target on its step (or globally
        // defaults to the options list).
        document.querySelectorAll('.workspace-menu-profile-step-back').forEach((backBtn) => {
            backBtn.addEventListener('click', () => {
                const target = backBtn.dataset.target || 'options';
                setProfileStep(target, { direction: 'back' });
            });
        });

        // "Edit your profile" on the view step - slide into the options list.
        document.getElementById('workspace-menu-profile-edit')?.addEventListener('click', () => {
            setProfileStep('options', { direction: 'forward' });
        });

        // Bio / Pronouns / Display Name save handler.
        document.getElementById('collab-share-profile-details-save')?.addEventListener('click', () => {
            const bioEl = document.getElementById('collab-share-profile-bio-input');
            const pronounsEl = document.getElementById('collab-share-profile-pronouns-input');
            const displayNameEl = document.getElementById('collab-share-profile-display-name-input');

            state.profileBio = (bioEl?.value || '').trim();
            state.profilePronouns = (pronounsEl?.value || '').trim();
            state.profileDisplayName = (displayNameEl?.value || '').trim();
            state.hasProfile = !!(state.profileImage || state.profileEmoji || state.profileBio || state.profilePronouns || state.profileDisplayName);

            scheduleProfileAutosave();
            setProfileStep('options', { direction: 'back' });
        });

        // Profile image upload → validate → crop
        const profileImageInput = document.getElementById('collab-share-profile-image-input');
        const profileImageError = document.getElementById('collab-share-profile-image-error');
        if (profileImageInput) {
            profileImageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) {
                    profileImageError.textContent = '';
                    return;
                }

                if (!VALID_IMAGE_TYPES.includes(file.type)) {
                    profileImageError.textContent = 'This file type isn\'t allowed (only PNG, JPG, JPEG, WebP are supported). .svg files are rejected to prevent security risks such as XSS or script injection.';
                    profileImageInput.value = '';
                    return;
                }

                if (file.size > MAX_UPLOAD_BYTES) {
                    profileImageError.textContent = 'File is too large. Maximum size is 5MB';
                    profileImageInput.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    profileImageError.textContent = '';
                    openCropTool(event.target.result);
                };
                reader.onerror = () => {
                    profileImageError.textContent = 'Unable to read this file. It may be corrupted - please try another file.';
                    profileImageInput.value = '';
                };
                reader.readAsDataURL(file);
            });
        }

        // Crop tool controls
        attachCropDragHandlers();
        document.getElementById('collab-share-crop-confirm')?.addEventListener('click', confirmCrop);
        document.getElementById('collab-share-crop-cancel')?.addEventListener('click', cancelCrop);

        // Custom profile accordion & Hover wave
        bindProfileCustomAccordion();
        bindColorSwatchWave();

        // Custom profile: live preview + debounced autosave on every change.
        // The visible inputs are now a button-grid (emoji) + a 5x5 swatch grid
        // (color); both write into the hidden inputs and trigger commits.
        const emojiInput = document.getElementById('collab-share-profile-emoji-input');
        const colorInput = document.getElementById('collab-share-profile-color-input');
        const emojiHelp = document.getElementById('collab-share-profile-emoji-help');
        const customPreview = document.getElementById('collab-share-profile-preview-custom');
        const emojiGrid = document.getElementById('collab-share-emoji-grid');
        const colorGrid = document.getElementById('collab-share-color-grid');

        const renderCustomPreview = () => {
            if (!customPreview) return;
            customPreview.style.background = colorInput?.value || '#e5cdcd';
            customPreview.textContent = emojiInput?.value || '';
        };

        const refreshEmojiSelection = () => {
            if (!emojiGrid) return;
            const selected = emojiInput?.value || '';
            emojiGrid.querySelectorAll('.collab-share-emoji-option').forEach((btn) => {
                const isMatch = btn.dataset.emoji === selected;
                btn.classList.toggle('is-selected', isMatch);
                btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
            });
        };

        const refreshColorSelection = () => {
            if (!colorGrid) return;
            const selected = (colorInput?.value || '').toLowerCase();
            colorGrid.querySelectorAll('.collab-share-color-swatch').forEach((btn) => {
                const isMatch = (btn.dataset.color || '').toLowerCase() === selected;
                btn.classList.toggle('is-selected', isMatch);
                btn.setAttribute('aria-checked', isMatch ? 'true' : 'false');
            });
        };

        const commitCustomProfile = () => {
            const emojiValue = (emojiInput?.value || '').trim();
            const colorValue = colorInput?.value || '#e5cdcd';

            if (!emojiValue) {
                if (emojiHelp) emojiHelp.textContent = 'Please choose an emoji';
                return;
            }
            if (!isLikelySingleEmoji(emojiValue)) {
                if (emojiHelp) emojiHelp.textContent = 'Please enter a single emoji';
                return;
            }
            if (emojiHelp) emojiHelp.textContent = '';

            state.profileImage = null;
            state.profileEmoji = emojiValue;
            state.profileBackground = colorValue;
            state.hasProfile = true;

            renderCustomPreview();
            scheduleProfileAutosave();
        };

        // Wire emoji grid - each button selects one emoji + commits.
        if (emojiGrid) {
            emojiGrid.addEventListener('click', (event) => {
                const target = /** @type {HTMLElement} */ (event.target);
                const emoji = target?.dataset?.emoji;
                if (!emoji) return;
                if (emojiInput) emojiInput.value = emoji;
                refreshEmojiSelection();
                renderCustomPreview();
                commitCustomProfile();
            });
        }

        // Wire color grid - each swatch picks one of 25 pastel colors + commits.
        if (colorGrid) {
            colorGrid.addEventListener('click', (event) => {
                const target = /** @type {HTMLElement} */ (event.target);
                const color = target?.dataset?.color;
                if (!color) return;
                if (colorInput) colorInput.value = color;
                refreshColorSelection();
                renderCustomPreview();
                commitCustomProfile();
            });
        }

        // Keep the swatch/emoji grids in sync if state is hydrated from storage.
        refreshEmojiSelection();
        refreshColorSelection();
        renderCustomPreview();

        // Delete Account
        document.getElementById('collab-share-profile-cancel-delete')?.addEventListener('click', () => {
            setProfileStep('options', { direction: 'back' });
        });

        document.getElementById('collab-share-profile-delete-confirm')?.addEventListener('click', async () => {
            const deleteButton = document.getElementById('collab-share-profile-delete-confirm');
            if (deleteButton) deleteButton.disabled = true;

            try {
                // Call the server-side delete endpoint to remove Profile, Note History, and Session History.
                if (config?.collab?.serverUrl) {
                    await fetch(`${config.collab.serverUrl}/account/delete`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: state.sessionId })
                    }).catch(() => {
                        // Even if the server call fails, still proceed with clearing client-side data.
                    });
                }
                // Clear client-side note/session history if the API is available.
                await noteAPI?.clearAllNoteHistory?.();
                await noteAPI?.clearSessionHistory?.();
            } finally {
                // Any active collaboration session keeps running until the user leaves it themselves,
                // so we don't call closeActiveSession() here, and we don't clear the already-published
                // awareness.profile (other users in the room will still see the cached profile from when they joined).

                state.profileImage = null;
                state.profileEmoji = '';
                state.profileBackground = '';
                state.profileBio = '';
                state.profilePronouns = '';
                state.profileDisplayName = '';
                state.hasProfile = false;
                state.userName = '';
                state.history = [];

                wipeLocalAccountData();
                updateWorkspaceMenuProfile();

                if (deleteButton) deleteButton.disabled = false;

                elements.nameInput.value = '';
                elements.nextStepButton.disabled = true;
                renderRoomCount();
                renderHistory();

                closeWorkspaceMenuProfileModal();
                showToast('Account deleted successfully');
            }
        });

        attachOtpHandlers();
    };

    const cleanup = () => {
        cleanupController();
        document.removeEventListener('keydown', handleGlobalKeydown);
        if (state.profileSyncTimer) clearTimeout(state.profileSyncTimer);
        if (state.profileSyncRetryTimer) clearTimeout(state.profileSyncRetryTimer);
        elements.nameInput?.removeEventListener('input', handleUserNameInput);
        if (window.__collabShareAPI) {
            delete window.__collabShareAPI;
        }
    };

    loadState();
    initializeListeners();

    return {
        destroy() {
            cleanup();
        }
    };
};