import { createZoomControlsMarkup } from './zoomControls.js';
import { createExportMenuMarkup } from './exportMenu.js';
import { ICON_CLOSE } from './profile/icon.js';

import { createProfileViewStep } from './profile/steps/viewStep.js';
import { createProfileOptionsStep } from './profile/steps/optionsStep.js';
import { createProfileUploadStep } from './profile/steps/uploadStep.js';
import { createProfileCustomStep } from './profile/steps/customStep.js';
import { createProfileDeleteStep } from './profile/steps/deleteStep.js';
import { createProfileDetailsStep } from './profile/steps/detailsStep.js';

/**
 * Creates the HTML markup for the workspace menu popover and its
 * dedicated Profile modal (#workspace-menu-view).
 * @param {Object} config
 * @returns {string}
 */
export const createWorkspaceMenuMarkup = (config) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '⌘' : 'Ctrl';

    return `
        <div id="workspace-menu" class="workspace-menu" aria-hidden="true" role="menu">
            <div class="workspace-menu-header-row">
                <button id="workspace-menu-profile" class="workspace-menu-profile" type="button" aria-label="Open your profile">
                    <span id="workspace-menu-profile-icon" class="workspace-menu-profile-icon"></span>
                    <span class="workspace-menu-profile-label">
                        <div id="workspace-menu-profile-view-name">Guest</div>
                    </span>
                </button>
            </div>

            <button id="workspace-open-marker" class="workspace-menu-action" type="button" role="menuitem">
                <span>Marker</span>
                <span class="hotkey">
                    <kbd class="modKey">${modKey}</kbd>+<kbd>D</kbd>
                </span>
            </button>

            <div class="workspace-menu-controls">
                <div class="${config.zoomControlsClass}">
                    ${createZoomControlsMarkup(config)}
                    ${createExportMenuMarkup(config)}
                </div>
            </div>

            <!-- Version 1.3.1 will develop it further -->
            <!--
            <button id="wm-open-settings" class="workspace-menu-action" type="button" role="menuitem">
                <span>Settings</span>
            </button>
            -->
        </div>

        <!-- Dedicated Profile modal, separate from the workspace menu popover above -->
        <div id="workspace-menu-view-root" class="workspace-menu-view-root">
            <div id="workspace-menu-view-panel" class="workspace-menu-view-panel">
                <div id="workspace-menu-view-overlay" class="workspace-menu-view-overlay"></div>
                <section id="workspace-menu-view" class="workspace-menu-view" role="dialog" aria-modal="true" aria-labelledby="workspace-menu-view-title">
                    <div class="workspace-menu-view-inner">
                        <div class="workspace-menu-view-header-bar">
                            <button id="workspace-menu-view-close" class="workspace-menu-view-close" type="button" aria-label="Close">
                                ${ICON_CLOSE}
                            </button>
                        </div>

                        <div id="workspace-menu-view-body" class="workspace-menu-view-body">
                            <div id="workspace-menu-profile-viewport" class="workspace-menu-profile-viewport">
                                <div class="workspace-menu-profile-steps">
                                    ${createProfileViewStep()}
                                    ${createProfileOptionsStep()}
                                    ${createProfileUploadStep()}
                                    ${createProfileCustomStep()}
                                    ${createProfileDeleteStep()}
                                    ${createProfileDetailsStep()}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    `;
};