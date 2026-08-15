import { ICON_BACK_ARROW } from '../icon.js';

export const createProfileOptionsStep = () => `
    <div id="wm-profile-step-options" class="workspace-menu-profile-step hidden" data-step="options">
        <button type="button" class="workspace-menu-profile-step-back" data-target="view" data-back aria-label="Back to profile view">
            ${ICON_BACK_ARROW}
        </button>

        <h3 class="collab-share-step-title collab-share-title-titlebar">Edit Profile</h3>

        <div class="collab-share-profile-options">
            <div class="collab-share-profile-option" data-profile-type="upload">
                <div class="collab-share-profile-option-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>
                </div>
                <div class="collab-share-profile-option-info">
                    <h3 class="collab-share-step-title">Upload Photo</h3>
                    <p class="collab-share-step-description">Click to Upload a profile photo</p>
                </div>
            </div>

            <div class="collab-share-profile-option" data-profile-type="custom">
                <div class="collab-share-profile-option-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M240-120q-45 0-89-22t-71-58q26 0 53-20.5t27-59.5q0-50 35-85t85-35q50 0 85 35t35 85q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T320-280q0-17-11.5-28.5T280-320q-17 0-28.5 11.5T240-280q0 23-5.5 42T220-202q5 2 10 2h10Zm230-160L360-470l358-358q11-11 27.5-11.5T774-828l54 54q12 12 12 28t-12 28L470-360Zm-190 80Z"/></svg>
                </div>
                <div class="collab-share-profile-option-info">
                    <h3 class="collab-share-step-title">Custom Profile</h3>
                    <p class="collab-share-step-description">Custom Preferences</p>
                </div>
            </div>

            <div class="collab-share-profile-option" data-profile-type="details">
                <div class="collab-share-profile-option-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M420-160v-520H200v-120h560v120H540v520H420Z"/></svg>
                </div>
                <div class="collab-share-profile-option-info">
                    <h3 class="collab-share-step-title">Bio &amp; Name</h3>
                    <p class="collab-share-step-description">Bio, Pronouns, Name</p>
                </div>
            </div>

            <div class="collab-share-profile-option" data-profile-type="delete">
                <div class="collab-share-profile-option-icon collab-share-profile-option-icon-danger">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                </div>
                <div class="collab-share-profile-option-info">
                    <h3 class="collab-share-step-title">Delete Account</h3>
                    <p class="collab-share-step-description">Delete account & data</p>
                </div>
            </div>
        </div>
    </div>
`;