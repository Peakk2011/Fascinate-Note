/**
 * @fileoverview Example usage of the Workspace API.
 * 
 * This script demonstrates how to initialize a workspace and connect its API
 * to UI elements like buttons.
 * 
 * To use this example, you need an HTML file with the following structure:
 * 
 * ```html
 * <!DOCTYPE html>
 * <html lang="en">
 * <head>
 *   <meta charset="UTF-8">
 *   <title>Workspace API Usage Example</title>
 *   <style>
 *     body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
 *     #workspace-container {
 *       width: 100vw;
 *       height: 100vh;
 *       background-color: #2a2a2a;
 *       position: relative;
 *       cursor: grab;
 *     }
 *     #controls {
 *       position: absolute;
 *       top: 10px;
 *       left: 10px;
 *       z-index: 100;
 *       display: flex;
 *       gap: 8px;
 *     }
 *     button {
 *       padding: 8px 12px;
 *       font-size: 14px;
 *       cursor: pointer;
 *     }
 *   </style>
 * </head>
 * <body>
 * 
 *   <div id="controls">
 *     <button id="zoom-in-btn">Zoom In (+)</button>
 *     <button id="zoom-out-btn">Zoom Out (-)</button>
 *     <button id="reset-zoom-btn">Reset Zoom (100%)</button>
 *   </div>
 * 
 *   <div id="workspace-container"></div>
 * 
 *   <!-- 
 *     Make sure to load this script as a module.
 *     The path to workspace.js should be correct.
 *   -->
 *   <script type="module" src="./usage.js"></script>
 * 
 * </body>
 * </html>
 * ```
 */

import { createWorkspace } from './workspace.js';

// Main function to set up the workspace
const initialize = async () => {
    try {
        // 1. Get the container element from the DOM
        const container = document.getElementById('workspace-container');
        if (!container) {
            console.error('Workspace container element not found!');
            return;
        }

        // 2. Create the workspace and wait for its API
        const workspaceApi = await createWorkspace(container, {
            onOpenNote: (noteId) => console.log('open note', noteId),
            onReturnToEditor: () => console.log('return to editor')
        });
        
        console.log('Workspace initialized successfully!', workspaceApi);

        // 3. Get control elements from the DOM
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const resetZoomBtn = document.getElementById('reset-zoom-btn');

        // 4. Connect the workspace API to the UI buttons
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', workspaceApi.zoomIn);
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', workspaceApi.zoomOut);
        }
        if (resetZoomBtn) {
            resetZoomBtn.addEventListener('click', workspaceApi.resetZoom);
        }

        // Example of using another API method
        container.addEventListener('click', (e) => {
            const coords = workspaceApi.getCanvasCoords(e);
            console.log('Clicked at workspace coordinates:', coords);
        });
        
        // You can store the api object for later use or to destroy the workspace
        // window.workspaceApi = workspaceApi;

    } catch (error) {
        console.error('Failed to initialize workspace:', error);
    }
};

// Run the initialization when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initialize);
