import { ICON_BACK_ARROW } from '../icon.js';

export const createProfileDeleteStep = () => `
    <div id="wm-profile-step-delete" class="workspace-menu-profile-step hidden" data-step="delete">
        <button type="button" class="workspace-menu-profile-step-back" data-back aria-label="Back to profile options">
            ${ICON_BACK_ARROW}
        </button>

        <h3 class="collab-share-step-title">Delete Account</h3>
        <p class="collab-share-step-description">Permanently delete <strong id="collab-share-profile-delete-username">Guest</strong> + all data. Cannot be undone.</p>

        <div class="collab-share-footer-row">
            <button id="collab-share-profile-cancel-delete" class="collab-share-secondary-button" type="button">Cancel</button>
            <button id="collab-share-profile-delete-confirm" class="collab-share-pill-button collab-share-danger-button" type="button">Delete</button>
        </div>
    </div>
`;