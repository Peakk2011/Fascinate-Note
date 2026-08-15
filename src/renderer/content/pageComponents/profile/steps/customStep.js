import { ICON_BACK_ARROW, ICON_ACCORDION_CHEVRON } from '../icon.js';
import { renderProfileEmojiOptions } from '../profileEmojiSet.js';
import { renderProfileColorSwatches, themeDefaultColorSets } from '../profileThemeColor.js';

export const createProfileCustomStep = () => `
    <div id="wm-profile-step-custom" class="workspace-menu-profile-step hidden" data-step="custom">
        <button type="button" class="workspace-menu-profile-step-back" data-back aria-label="Back to profile options">
            ${ICON_BACK_ARROW}
        </button>

        <h3 class="collab-share-step-title collab-share-title-titlebar">Custom Profile</h3>

        <div class="collab-share-preview-container">
            <div id="collab-share-profile-preview-custom" class="collab-share-profile-preview"></div>
        </div>

        <div class="collab-share-accordion" data-accordion-group>

            <div class="collab-share-accordion-item is-open" data-accordion-item="emoji">
                <button type="button" class="collab-share-accordion-header" data-accordion-toggle aria-expanded="true" aria-controls="collab-share-emoji-panel">
                    <span class="collab-share-label">Emoji</span>
                    ${ICON_ACCORDION_CHEVRON}
                </button>
                <div id="collab-share-emoji-panel" class="collab-share-accordion-panel" role="region">
                    <div class="collab-share-accordion-panel-inner">
                        <div id="collab-share-emoji-grid-scroll" class="collab-share-emoji-grid-scroll">
                            <div id="collab-share-emoji-grid" class="collab-share-emoji-grid" role="listbox" aria-label="Choose an emoji">
                                ${renderProfileEmojiOptions()}
                            </div>
                        </div>
                        <input type="hidden" id="collab-share-profile-emoji-input" value="" />
                    </div>
                </div>
            </div>

            <div class="collab-share-accordion-item" data-accordion-item="color">
                <button type="button" class="collab-share-accordion-header" data-accordion-toggle aria-expanded="false" aria-controls="collab-share-color-panel">
                    <span class="collab-share-label">Background color</span>
                    ${ICON_ACCORDION_CHEVRON}
                </button>
                <div id="collab-share-color-panel" class="collab-share-accordion-panel" role="region">
                    <div class="collab-share-accordion-panel-inner collab-share-accordion-color-palatte">
                        <div id="collab-share-color-grid" class="collab-share-color-grid" role="radiogroup" aria-label="Choose a background color">
                            ${renderProfileColorSwatches()}
                        </div>
                        <input type="hidden" id="collab-share-profile-color-input" value="${themeDefaultColorSets}" />
                    </div>
                </div>
            </div>

        </div>
    </div>
`;