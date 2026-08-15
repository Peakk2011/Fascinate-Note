/**
 * Returns a Promise that resolves after a given delay.
 * Supports cancellation via AbortSignal - integrates with
 * the same AbortController used for fetch or other async ops.
 *
 * @param {number} ms            - Delay in milliseconds (must be ≥ 0)
 * @param {AbortSignal} [signal] - Optional AbortSignal to cancel the wait early.
 *                                 Rejects with `signal.reason` if aborted.
 * @returns {Promise<void>}
 */
const wait = (ms, signal) => {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason);

        const onAbort = () => {
            clearTimeout(id);
            reject(signal.reason);
        };

        const id = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, ms);

        signal?.addEventListener("abort", onAbort, { once: true });
    });
};

export default wait;