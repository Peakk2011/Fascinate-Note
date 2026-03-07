/**
 * Creates and manages the command palette modal structure
 */
export class CommandPaletteModal {
    constructor(config) {
        this.config = config;
        this.modal = null;
        this.content = null;
        this.input = null;
        this.results = null;
        this.modeIndicator = null;
    }

    getMarkup() {
        return `
            <div id="${this.config.modalId}" class="command-palette-modal" role="dialog" aria-modal="true">
                <div class="${this.config.contentClass}">
                    <div class="${this.config.headerClass}">
                        <input type="text" id="command-palette-input" class="${this.config.inputClass}" placeholder="Type a command or /...">
                        <div class="command-palette-mode"></div>
                    </div>
                    <div id="command-palette-results" class="${this.config.resultsClass}"></div>
                </div>
            </div>
        `;
    }

    init() {
        this.modal = document.getElementById(this.config.modalId);
        this.content = this.modal.querySelector(`.${this.config.contentClass}`);
        this.input = document.getElementById('command-palette-input');
        this.results = document.getElementById('command-palette-results');
        this.modeIndicator = this.modal.querySelector('.command-palette-mode');
    }

    setDisplay() {
        this.modal.style.display = 'flex';
    }

    startShowAnimation(onAnimationStart, onAnimationEnd) {
        requestAnimationFrame(() => {
            this.modal.classList.add('visible');
            this.content.classList.remove('closing');
            this.content.classList.add('opening');

            if (onAnimationStart) onAnimationStart();

            setTimeout(() => {
                this.input.focus();
                if (onAnimationEnd) onAnimationEnd();
            }, 250);
        });
    }

    /**
     * Hide modal
     */
    hide(onComplete) {
        this.content.classList.remove('opening');
        this.content.classList.add('closing');

        setTimeout(() => {
            this.modal.classList.remove('visible');
            this.modal.style.display = 'none';
            this.content.classList.remove('closing');
            if (onComplete) onComplete();
        }, 200);
    }

    reset() {
        this.input.value = '';
        this.results.innerHTML = '';
        this.modeIndicator.style.display = 'none';
    }

    setModeIndicator(text, visible) {
        // console.log('[Modal] setModeIndicator:', text, visible, this.modeIndicator);
        // console.trace();
        this.modeIndicator.textContent = text;
        this.modeIndicator.style.display = visible ? 'block' : 'none';
        // console.log('[Modal] after set, display is:', this.modeIndicator.style.display);
    }

    clearInput() {
        this.input.value = '';
    }

    focusInput() {
        setTimeout(() => this.input.focus(), 0);
    }
}