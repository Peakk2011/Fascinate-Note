import { CursorManager } from '../utils/CursorManager.js';
import { CommandPaletteModal } from '../components/CommandPaletteModal.js';
import { CommandPaletteInput } from '../components/CommandPaletteInput.js';
import { CommandPaletteResults } from '../components/CommandPaletteResults.js';
import { InputHandler } from '../handlers/InputHandler.js';
import { CommandExecutor } from '../handlers/CommandExecutor.js';
import { EventManager } from '../handlers/EventManager.js';

export class CommandPaletteController {
    constructor(config, systemCommands, markdownCommands, markerCommands, apis) {
        this.config = config;

        // State
        this.isVisible = false;
        this.isAnimating = false;
        this.currentMode = 'system';
        this.savedCursorPosition = null;

        // Components
        this.modal = new CommandPaletteModal(config);
        this.inputComponent = null;
        this.resultsComponent = null;

        // Handlers
        this.inputHandler = new InputHandler(systemCommands, markdownCommands, markerCommands);
        this.commandExecutor = new CommandExecutor(apis.noteAPI, apis.markerAPI);
        this.eventManager = new EventManager();
    }

    init() {
        this.modal.init();
        
        this.inputComponent = new CommandPaletteInput(this.modal.input);
        this.resultsComponent = new CommandPaletteResults(
            this.modal.results,
            this.config.itemClass
        );

        this.#setupEventHandlers();
    }

    #setupEventHandlers() {
        this.inputComponent.onInput((value, isMarkdownMode) => {
            this.#handleInputChange(value, isMarkdownMode);
        });

        this.inputComponent.onKeyDown((e) => {
            this.resultsComponent.handleKeyDown(e);
        });

        this.eventManager.registerClickOutside(this.modal.modal, () => this.hide());
        this.eventManager.registerEscapeKey(() => this.hide(), () => this.isVisible);

        this.resultsComponent.preventBlurOnClick(this.modal.input);
    }

    #handleInputChange(value, isMarkdownMode) {
        if (this.currentMode === 'marker') {
            this.#switchToMarkerMode(value);
        } else if (isMarkdownMode) {
            this.#switchToMarkdownMode(value);
        } else {
            this.#switchToSystemMode(value);
        }
    }

    #switchToMarkdownMode(searchValue) {
        if (this.currentMode !== 'markdown') {
            this.currentMode = 'markdown';
            this.modal.setModeIndicator('Markdown Commands', true);
        }

        const filtered = this.inputHandler.filterMarkdownCommands(searchValue);
        this.#renderMarkdownCommands(filtered);
    }

    #switchToSystemMode(searchValue) {
        if (this.currentMode !== 'system') {
            this.currentMode = 'system';
            this.modal.setModeIndicator('', false);
        }

        const filtered = this.inputHandler.filterSystemCommands(searchValue);
        this.#renderSystemCommands(filtered);
    }

    #switchToMarkerMode(searchValue) {
        if (this.currentMode !== 'marker') {
            this.currentMode = 'marker';
            this.modal.setModeIndicator('Marker Commands', true);
        }

        const filtered = this.inputHandler.filterMarkerCommands(searchValue);
        this.#renderMarkerCommands(filtered);
    }

    #renderSystemCommands(commands) {
        this.resultsComponent.render(
            commands,
            false,
            (command) => {
                this.commandExecutor.executeSystemCommand(command);
                this.hide();
            },
            null
        );
    }

    #renderMarkdownCommands(commands) {
        this.resultsComponent.render(
            commands,
            true,
            null,
            (command) => {
                try {
                    this.commandExecutor.executeMarkdownCommand(command, this.savedCursorPosition);
                } catch (err) {
                    console.error('[CommandPalette] Failed to apply markdown', err);
                } finally {
                    this.hide();
                }
            }
        );
    }

    #renderMarkerCommands(commands) {
        this.resultsComponent.render(
            commands,
            false,
            (command) => {
                this.commandExecutor.executeMarkerCommand(command);
                this.hide();
            },
            null
        );
    }

    /**
     * Show palette
     */
    show(mode = 'system') {
        console.log('[Show] mode received:', mode)
        if (this.isVisible || this.isAnimating) return;

        this.isAnimating = true;
        this.currentMode = mode;

        this.savedCursorPosition = CursorManager.save();

        // Set display first
        this.modal.setDisplay();
        console.log('[Show] after ClearInput');

        // Clear input
        this.modal.clearInput();
        console.log('[Show] after ClearInput');

        // Render results before animation
        if (mode === 'markdown') {
            this.modal.setModeIndicator('Markdown Commands', true);
            console.log('[Show] after setModeIndicator Markdown');
            this.#renderMarkdownCommands(this.inputHandler.getAllMarkdownCommands());
        } else if (mode === 'marker') {
            this.modal.setModeIndicator('Marker Commands', true);
            console.log('[Show] after setModeIndicator Fascinate Notes Marker');
            this.#renderMarkerCommands(this.inputHandler.getAllMarkerCommands());
        } else {
            this.modal.setModeIndicator('', false);
            this.#renderSystemCommands(this.inputHandler.getAllSystemCommands());
        }

        // Start animation
        this.modal.startShowAnimation(
            () => {
                this.isVisible = true;
            },
            () => {
                this.isAnimating = false;
            }
        );
    }

    hide() {
        if (!this.isVisible || this.isAnimating) return;

        this.isAnimating = true;

        this.modal.hide(() => {
            this.modal.reset();
            this.currentMode = 'system';
            this.isVisible = false;
            this.isAnimating = false;

            const editor = window.rich?.editor || document.querySelector('[contenteditable]');
            if (editor) {
                editor.focus();
                CursorManager.restore(this.savedCursorPosition, editor);
            }
        });
    }

    toggle(mode = 'system') {
        if (this.isAnimating) return;

        if (!this.isVisible) {
            this.show(mode);
            return;
        }

        if (this.currentMode === mode) {
            this.hide();
            return;
        }

        // Switch mode without hiding
        this.currentMode = mode;
        this.modal.clearInput();

        if (mode === 'markdown') {
            this.modal.setModeIndicator('Markdown Commands', true);
            this.#renderMarkdownCommands(this.inputHandler.getAllMarkdownCommands());
        } else if (mode === 'marker') {
            this.modal.setModeIndicator('Marker Commands', true);
            this.#renderMarkerCommands(this.inputHandler.getAllMarkerCommands());
        } else {
            this.modal.setModeIndicator('', false);
            this.#renderSystemCommands(this.inputHandler.getAllSystemCommands());
        }

        this.modal.focusInput();
    }

    showMarkdownCommands() {
        this.show('markdown');
    }

    destroy() {
        this.inputComponent?.destroy();
        this.eventManager.destroy();
    }
}