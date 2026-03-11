import { Mint } from '@mintkit';
Mint.include('stylesheet/style-components/find.css');

/**
 * Creates a New Group modal using Model Find UI
 * @param {Object} options
 * @param {Function} options.onConfirm - callback รับ (name) เมื่อกด confirm
 * @returns {Object} { markups, init }
 */
export const createMarkerGroupModal = ({ onConfirm } = {}) => {
    const IDS = {
        modal: 'marker-group-modal',
        close: 'marker-group-close-btn',
        input: 'marker-group-input',
        status: 'marker-group-status',
        confirm: 'marker-group-confirm-btn',
    };

    const api = {
        markups: `
            <div id="${IDS.modal}" class="modal" role="dialog" aria-labelledby="marker-group-modal-title" aria-modal="true">
                <div class="modal-content">
                    <div class="modal-header">
                        <button
                            id="${IDS.close}"
                            class="close-button"
                            aria-label="Close"
                            type="button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <textarea
                            id="${IDS.input}"
                            placeholder="Group name…"
                            aria-label="Group name"
                            autocomplete="off"
                            spellcheck="false"
                            maxlength="36"
                            rows="1"></textarea>
                        <span
                            id="${IDS.status}"
                            class="find-status"
                            role="status"
                            aria-live="polite"></span>
                        <button
                            id="${IDS.confirm}"
                            type="button"
                            aria-label="Create group">
                            New Group
                        </button>
                    </div>
                </div>
            </div>
        `,

        init() {
            const modal = document.getElementById(IDS.modal);
            const closeBtn = document.getElementById(IDS.close);
            const input = document.getElementById(IDS.input);
            const status = document.getElementById(IDS.status);
            const confirmBtn = document.getElementById(IDS.confirm);

            if (!modal || !closeBtn || !input || !confirmBtn) {
                console.error('[MarkerGroupModal] Missing DOM elements');
                return;
            }

            const showStatus = (msg, type = 'error') => {
                status.textContent = msg;
                status.className = `find-status find-status--${type}`;
            };

            const clearStatus = () => {
                status.textContent = '';
            };

            const show = () => {
                modal.style.display = 'flex';
                requestAnimationFrame(() => {
                    modal.classList.add('visible');
                    setTimeout(() => {
                        input.focus();
                        input.select();
                    }, 50);
                });
            };

            const hide = () => {
                modal.classList.remove('visible');
                modal.addEventListener('transitionend', (e) => {
                    if (e.target === modal && e.propertyName === 'opacity') {
                        modal.style.display = 'none';
                        input.value = '';
                        clearStatus();
                    }
                }, { once: true });
            };

            const handleConfirm = () => {
                const name = input.value.trim();
                if (!name) {
                    showStatus('Enter a group name');
                    return;
                }
                onConfirm?.(name.slice(0, 36));
                hide();
            };

            closeBtn.addEventListener('click', hide);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) hide();
            });

            confirmBtn.addEventListener('click', handleConfirm);

            input.addEventListener('input', clearStatus);

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                }
                if (e.key === 'Escape') hide();
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.style.display === 'flex') {
                    hide();
                }
            });

            return { show, hide };
        }
    };

    return api;
};