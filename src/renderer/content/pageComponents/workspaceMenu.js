import { createZoomControlsMarkup } from './zoomControls.js';
import { createExportMenuMarkup } from './exportMenu.js';

/**
 * Creates the HTML markup for the workspace menu.
 * This menu hosts the Marker toggle and the zoom/export controls.
 * @param {Object} config
 * @returns {string}
 */
export const createWorkspaceMenuMarkup = (config) => {
    return `
        <div id="workspace-menu" class="workspace-menu" aria-hidden="true">
            <div class="workspace-menu-header">Workspace</div>
            <div class="workspace-menu-showcase">
                <picture>
                    <source srcset="/showcase/marker-preview-dark.svg" media="(prefers-color-scheme: dark)" />
                    <img src="/showcase/marker-preview.svg" alt="Workspace Showcase" />
                </picture>
            </div>
            <button id="workspace-open-marker" class="workspace-menu-action" type="button">Marker</button>
            <div class="workspace-menu-controls">
                <div class="${config.zoomControlsClass}">
                    ${createZoomControlsMarkup(config)}
                    ${createExportMenuMarkup(config)}
                </div>
            </div>
        </div>
    `;
};