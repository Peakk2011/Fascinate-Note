import { getSelectionOffsets, restoreSelection } from '../selection/index.js';
import DOMPurify from 'dompurify';

export const createHtmlSync = ({
    editor,
    ytext,
    doc,
    debounceMs = 120,
    seedLocalOnEmpty = false,
    isDestroyed,
    onRemoteApplied
} = {}) => {
    let lastHtml = editor?.innerHTML || '';
    let applyingRemote = false;
    let localTimer = null;

    // From another peer via Y.Text and could carry injected <script>
    // Tags or event-handler attributes
    // Strips those while keeping normal formatting
    const applyRemoteHtml = (nextHtml) => {
        if (isDestroyed?.()) return;

        const cleanHtml = DOMPurify.sanitize(nextHtml);
        if (cleanHtml === lastHtml) return;

        if (localTimer) {
            clearTimeout(localTimer);
            localTimer = null;
        }

        const selection = getSelectionOffsets(editor);

        applyingRemote = true;
        try {
            editor.innerHTML = cleanHtml;
            lastHtml = cleanHtml;

            if (selection) {
                restoreSelection(editor, selection);
            }

            editor.dispatchEvent(new Event('input', { bubbles: true }));
        } finally {
            applyingRemote = false;
        }

        if (onRemoteApplied) {
            onRemoteApplied();
        }
    };

    // Push local edits into the shared Y.Text
    const pushLocal = () => {
        if (isDestroyed?.() || applyingRemote) return;
        const html = editor.innerHTML || '';
        if (html === lastHtml) return;

        doc.transact(() => {
            const currentLength = ytext.length;
            if (currentLength > 0) {
                ytext.delete(0, currentLength);
            }
            if (html) {
                ytext.insert(0, html);
            }
        });
        lastHtml = html;
    };

    // Debounced trigger for local edits
    const schedulePush = () => {
        if (isDestroyed?.() || applyingRemote) return;
        if (localTimer) clearTimeout(localTimer);

        localTimer = setTimeout(() => {
            localTimer = null;
            pushLocal();
        }, debounceMs);
    };

    const handleTextUpdate = (event) => {
        if (isDestroyed?.()) return;
        if (event?.transaction?.local) return;
        const remoteHtml = ytext.toString();
        applyRemoteHtml(remoteHtml);
    };

    const handleSync = (isSynced) => {
        if (!isSynced) return;
        const remoteHtml = ytext.toString();
        if (remoteHtml && remoteHtml.length > 0) {
            applyRemoteHtml(remoteHtml);
        } else if (seedLocalOnEmpty) {
            pushLocal();
        } else {
            applyRemoteHtml('');
        }
    };

    const destroy = () => {
        if (localTimer) {
            clearTimeout(localTimer);
            localTimer = null;
        }
    };

    return {
        schedulePush,
        handleTextUpdate,
        handleSync,
        destroy
    };
};