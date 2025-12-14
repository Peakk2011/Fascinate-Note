import { Mint } from '../../../../framework/mint.js';
import { fetchJSON } from '../../../../utils/fetch.js';

Mint.include('stylesheet/style-components/command-palette.css');

export const createCommandPalette = async () => {
    let config;

    try {
        config = await fetchJSON(
            'renderer/content/contentComponents/commandPalette/commandPaletteConfig.json'
        );
    } catch (error) {
        console.error('[CommandPalette] Failed to load configuration:', error);
        throw new Error('Command Palette configuration could not be loaded');
    }

    const commands = [
        { id: 'save', label: 'Save Note', action: 'saveData' },
        { id: 'load', label: 'Load Note', action: 'loadData' },
        { id: 'zoomIn', label: 'Zoom In', action: 'zoomIn' },
        { id: 'zoomOut', label: 'Zoom Out', action: 'zoomOut' },
        { id: 'resetZoom', label: 'Reset Zoom', action: 'resetZoom' },
    ];

    return {
        markups: `
            <div id="${config.modalId}" class="command-palette-modal" role="dialog" aria-modal="true">
                <div class="${config.contentClass}">
                    <div class="${config.headerClass}">
                        <input type="text" id="command-palette-input" class="${config.inputClass}" placeholder="Type a command...">
                    </div>
                    <div id="command-palette-results" class="${config.resultsClass}"></div>
                </div>
            </div>
        `,
        init({ noteAPI }) {
            const modal = document.getElementById(config.modalId);
            const content = modal.querySelector(`.${config.contentClass}`);
            const input = document.getElementById('command-palette-input');
            const results = document.getElementById('command-palette-results');
            
            let isVisible = false;

            const renderResults = (filteredCommands) => {
                results.innerHTML = '';
                filteredCommands.forEach(command => {
                    const div = document.createElement('div');
                    div.textContent = command.label;
                    div.classList.add(config.itemClass);
                    div.addEventListener('click', () => {
                        if (noteAPI && typeof noteAPI[command.action] === 'function') {
                            noteAPI[command.action]();
                        }
                        hide();
                    });
                    results.appendChild(div);
                });
            };

            const handleInput = () => {
                const value = input.value.toLowerCase();
                const filteredCommands = commands.filter(c => c.label.toLowerCase().includes(value));
                renderResults(filteredCommands);
            };

            const show = () => {
                if (!modal || isVisible) return;
                
                modal.classList.add('visible');
                content.classList.remove('closing');
                isVisible = true;
                input.focus();
                input.value = '';
                renderResults(commands);
            };

            const hide = () => {
                if (!modal || !isVisible) return;

                content.classList.add('closing');
                
                const onAnimationEnd = () => {
                    modal.classList.remove('visible');
                    content.classList.remove('closing');
                    content.removeEventListener('animationend', onAnimationEnd);
                    isVisible = false;
                };

                content.addEventListener('animationend', onAnimationEnd);
            };

            const toggle = () => {
                if (isVisible) {
                    hide();
                } else {
                    show();
                }
            };
            
            input.addEventListener('input', handleInput);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    hide();
                }
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && isVisible) {
                    hide();
                }
            });

            const destroy = () => {
                // Cleanup
            };

            return {
                show,
                hide,
                toggle,
                destroy
            };
        }
    };
};