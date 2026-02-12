import { CommandItem } from './CommandItem.js';

/**
 * Manages command palette results rendering and keyboard navigation
 */
export class CommandPaletteResults {
    constructor(resultsElement, itemClass) {
        this.results = resultsElement;
        this.itemClass = itemClass;
        this.activeIndex = -1;
        this.clickHandlers = new Map();
    }

    getItems() {
        return Array.from(this.results.querySelectorAll(`.${this.itemClass}`));
    }

    clearActive() {
        this.getItems().forEach(i => i.classList.remove('active'));
        this.activeIndex = -1;
    }

    setActive(index) {
        const items = this.getItems();
        if (!items.length) return;
        
        if (index < 0) index = items.length - 1;
        if (index >= items.length) index = 0;
        
        this.clearActive();
        
        const el = items[index];
        if (el) {
            el.classList.add('active');
            
            try {
                el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            } catch (e) {}
            
            this.activeIndex = index;
        }
    }

    clickActive() {
        if (this.activeIndex >= 0) {
            const items = this.getItems();
            const activeItem = items[this.activeIndex];
            if (activeItem) activeItem.click();
        }
    }

    /**
     * Render commands with smooth height animation
     * @param {Array} commands
     * @param {boolean} isMarkdownMode
     * @param {Function} onSystemClick
     * @param {Function} onMarkdownClick
     * @returns {void}
     */
    render(commands, isMarkdownMode, onSystemClick, onMarkdownClick) {
        // measure previous height
        const prevHeight = this.results.getBoundingClientRect().height || 0;

        // build fragment
        const frag = document.createDocumentFragment();

        // Clear old click handlers
        this.clickHandlers.clear();

        if (!commands || commands.length === 0) {
            frag.appendChild(CommandItem.createEmptyState());
        } else {
            commands.forEach((command, idx) => {
                const div = isMarkdownMode 
                    ? CommandItem.createMarkdownItem(command, idx, this.itemClass)
                    : CommandItem.createSystemItem(command, idx, this.itemClass);

                // Attach click handler
                const clickHandler = () => {
                    if (isMarkdownMode) {
                        onMarkdownClick(command);
                    } else {
                        onSystemClick(command);
                    }
                };
                
                div.addEventListener('click', clickHandler);
                this.clickHandlers.set(div, clickHandler);

                // Hover handler
                div.addEventListener('mouseover', () => this.setActive(idx));

                frag.appendChild(div);
            });
        }

        // measure new height using hidden temp
        const temp = document.createElement('div');
        temp.style.position = 'absolute';
        temp.style.visibility = 'hidden';
        temp.style.pointerEvents = 'none';
        temp.style.width = this.results.clientWidth + 'px';
        temp.appendChild(frag.cloneNode(true));
        this.results.parentElement.appendChild(temp);
        const newScrollHeight = Math.min(temp.scrollHeight, 400);
        temp.parentElement.removeChild(temp);

        // animate
        this.results.style.height = prevHeight + 'px';
        this.results.style.overflow = 'hidden';

        // * height animation transition
        this.results.style.transition = 'height 200ms var(--transition)';

        // replace content
        this.results.innerHTML = '';
        this.results.appendChild(frag);

        requestAnimationFrame(() => {
            this.results.style.height = newScrollHeight + 'px';
        });

        const onEnd = () => {
            this.results.style.transition = '';
            this.results.style.height = '';
            this.results.style.overflow = newScrollHeight >= 400 ? 'auto' : 'hidden';
            this.results.removeEventListener('transitionend', onEnd);
        };

        this.results.addEventListener('transitionend', onEnd);

        // reset active
        this.clearActive();
    }

    handleKeyDown(e) {
        const items = this.getItems();
        if (!items.length) return false;

        if (e.key === 'ArrowDown' || e.code === 'ArrowDown') {
            e.preventDefault();
            this.setActive(this.activeIndex + 1);
            return true;
        }

        if (e.key === 'ArrowUp' || e.code === 'ArrowUp') {
            e.preventDefault();
            this.setActive(this.activeIndex - 1);
            return true;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            this.setActive(this.activeIndex + 1);
            return true;
        }

        if (e.key === 'Enter') {
            if (this.activeIndex >= 0) {
                e.preventDefault();
                this.clickActive();
                return true;
            }
        }

        return false;
    }

    preventBlurOnClick(input) {
        this.results.addEventListener('mousedown', (e) => {
            e.preventDefault();
            try { input.focus(); } catch (err) {}
        });
    }

    clear() {
        this.results.innerHTML = '';
        this.clickHandlers.clear();
        this.clearActive();
    }
}