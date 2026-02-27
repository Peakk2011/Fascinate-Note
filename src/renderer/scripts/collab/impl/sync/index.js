import { getSelectionOffsets, restoreSelection } from '../selection/index.js';

export const createHtmlSync = ({
    editor,
    ytext,
    doc,
    debounceMs = 120,
    isDestroyed,
    onRemoteApplied
} = {}) => {
    let lastHtml = editor?.innerHTML || '';
    let applyingRemote = false;
    let localTimer = null;

    const applyRemoteHtml = (nextHtml) => {
        if (isDestroyed?.()) return;
        if (nextHtml === lastHtml) return;

        const selection = getSelectionOffsets(editor);

        applyingRemote = true;
        editor.innerHTML = nextHtml;
        lastHtml = nextHtml;
        applyingRemote = false;

        if (selection) {
            restoreSelection(editor, selection);
        }

        editor.dispatchEvent(new Event('input', { bubbles: true }));
        if (onRemoteApplied) {
            onRemoteApplied();
        }
    };

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
        } else {
            pushLocal();
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