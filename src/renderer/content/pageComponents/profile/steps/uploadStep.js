import { ICON_BACK_ARROW } from '../icon.js';

export const createProfileUploadStep = () => `
    <div id="wm-profile-step-upload" class="workspace-menu-profile-step hidden" data-step="upload">
        <button type="button" class="workspace-menu-profile-step-back" data-back aria-label="Back to profile options">
            ${ICON_BACK_ARROW}
        </button>

        <h3 class="collab-share-step-title collab-share-title-titlebar">Upload Profile</h3>

        <div id="collab-share-profile-image-error" class="collab-share-error" aria-live="polite"></div>

        <div id="collab-share-crop-container" class="collab-share-crop-container hidden">
            <div id="collab-share-crop-viewport" class="collab-share-crop-viewport">
                <img id="collab-share-crop-image" class="collab-share-crop-image" alt="Crop preview" draggable="false" />
            </div>
            <input id="collab-share-crop-zoom" class="collab-share-crop-zoom" type="range" min="1" max="3" step="0.01" value="1" aria-label="Zoom image" />
            <div class="collab-share-footer-row wm-crop-operator-btn">
                <div class="collab-share-crop-undo-redo">
                    <button id="collab-share-crop-undo" class="collab-share-icon-button" type="button" aria-label="Undo crop change" disabled>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" fill="currentColor" opacity="0.85"/>
                        </svg>
                    </button>
                    <button id="collab-share-crop-redo" class="collab-share-icon-button" type="button" aria-label="Redo crop change" disabled>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" fill="currentColor" opacity="0.85"/>
                        </svg>
                    </button>
                </div>
                <button id="collab-share-crop-cancel" class="collab-share-secondary-button" type="button">Cancel</button>
                <button id="collab-share-crop-confirm" class="collab-share-pill-button" type="button">Confirm Crop</button>
            </div>
            <p class="collab-share-hint wm-collab-hint">Drag to move, slide to zoom, then confirm.</p>
        </div>

        <label for="collab-share-profile-image-input" id="collab-share-profile-preview-container" class="collab-share-profile-preview-container" role="button" aria-label="Upload a profile photo">
            <div id="collab-share-profile-preview" class="collab-share-profile-preview"></div>
                <span class="collab-share-profile-preview-badge" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="var(--theme-accent)"><path d="M0 0h24v24H0V0z" fill="none"/><circle cx="12" cy="12" r="3"/><path d="M9 2L7.17 4H2v16h20V4h-5.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>
                    <p>Click to upload a profile photo</p>
                </span>
        </label>

        <input id="collab-share-profile-image-input" class="collab-share-input collab-share-file-input-hidden" type="file" accept="image/png,image/jpeg,image/webp" />
    </div>
`;