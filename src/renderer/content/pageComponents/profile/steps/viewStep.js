export const createProfileViewStep = () => `
    <div id="wm-profile-step-view" class="workspace-menu-profile-step is-active" data-step="view">
        <div class="workspace-menu-profile-view-avatar-wrap">
            <div id="workspace-menu-profile-view-avatar" class="workspace-menu-profile-view-avatar" aria-hidden="true"></div>
            <div id="workspace-menu-profile-view-name" class="workspace-menu-profile-view-name">Guest</div>
        </div>

        <div class="workspace-menu-profile-view-fields">
            <div class="workspace-menu-profile-view-field">
                <span class="workspace-menu-profile-view-field-label">Bio</span>
                <span id="workspace-menu-profile-view-bio" class="workspace-menu-profile-view-field-value workspace-menu-profile-view-field-empty">No bio yet</span>
            </div>
            <div class="workspace-menu-profile-view-field pronouns-workspace-menu-section">
                <span class="workspace-menu-profile-view-field-label">Pronouns</span>
                <span id="workspace-menu-profile-view-pronouns" class="workspace-menu-profile-view-field-value workspace-menu-profile-view-field-empty">Not set</span>
            </div>
            <div class="workspace-menu-profile-view-field">
                <span class="workspace-menu-profile-view-field-label">Display Name</span>
                <span id="workspace-menu-profile-view-display-name" class="workspace-menu-profile-view-field-value workspace-menu-profile-view-field-empty">Not set</span>
            </div>
        </div>

        <button id="workspace-menu-profile-edit" type="button" class="collab-share-pill-button">Edit your profile</button>
    </div>
`;