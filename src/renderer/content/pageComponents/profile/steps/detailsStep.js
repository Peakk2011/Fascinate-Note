import { ICON_BACK_ARROW } from '../icon.js';

export const createProfileDetailsStep = () => `
    <div id="wm-profile-step-details" class="workspace-menu-profile-step hidden" data-step="details">
        <button type="button" class="workspace-menu-profile-step-back" data-back aria-label="Back to profile options">
            ${ICON_BACK_ARROW}
        </button>

        <h3 class="collab-share-step-title">Bio &amp; Name</h3>
        <p class="collab-share-step-description" style="transform: translateY(-4px)">Shown beside profile</p>

        <section class="wm-meta-desc wm-meta-description-bio">
            <div class="collab-share-label-row wm-meta-description-details">
                <span class="collab-share-label">Bio</span>
            </div>
            <textarea id="collab-share-profile-bio-input" class="collab-share-input collab-share-textarea" rows="3" maxlength="160" placeholder="Tell others a bit about yourself"></textarea>
        </section>

        <section class="wm-meta-desc wm-meta-description-pronouns">
            <div class="collab-share-label-row wm-meta-description-details">
                <span class="collab-share-label">Pronouns</span>
            </div>
            <input id="collab-share-profile-pronouns-input" class="collab-share-input" type="text" maxlength="32" placeholder="e.g. she/her, they/them" autocomplete="off" />
        </section>

        <section class="wm-meta-desc wm-meta-description-display-name">
            <div class="collab-share-label-row wm-meta-description-details">
                <span class="collab-share-label">Display Name</span>
            </div>
            <input id="collab-share-profile-display-name-input" class="collab-share-input" type="text" maxlength="32" placeholder="Name shown in rooms" autocomplete="off" />
        </section>

        <button id="collab-share-profile-details-save" type="button" class="collab-share-pill-button">Save</button>
    </div>
`;