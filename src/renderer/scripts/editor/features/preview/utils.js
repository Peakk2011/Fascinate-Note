/**
 * URL preview card system - utilities
 * @module urlPreview/utils
 */

// Normalize and validate HTTP/HTTPS URLs
export const normalizeHttpUrl = (rawUrl) => {
    if (!rawUrl) return null;
    const trimmed = String(rawUrl).trim();
    if (!trimmed || /\s/.test(trimmed)) return null;

    try {
        const normalizedInput = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
        const parsed = new URL(normalizedInput);

        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href;
        }
    } catch {}

    return null;
};

export const isYouTubeUrl = (url) => {
    const normalized = normalizeHttpUrl(url);
    if (!normalized) return false;

    try {
        const host = new URL(normalized).hostname.toLowerCase();

        return host === 'youtu.be' ||
            host.endsWith('youtube.com') ||
            host.endsWith('youtube-nocookie.com');
    } catch {
        return false;
    }
};

// Fetch URL preview metadata from noembed.com
export const resolvePreview = async (url, signal) => {
    const normalizedUrl = normalizeHttpUrl(url);

    if (!normalizedUrl) {
        throw new Error('Invalid or unsupported URL format');
    }

    const encoded = encodeURIComponent(normalizedUrl);
    const parsed  = new URL(normalizedUrl);

    try {
        const res = await fetch(`https://noembed.com/embed?url=${encoded}`, { signal });
        if (res.ok) {
            const data = await res.json();
            if (data.error) {
                const message = String(data.error || '').toLowerCase();
                if (message.includes('no matching providers')) {
                    return { title: parsed.hostname, image: null, providerName: '' };
                }
                throw new Error(data.error);
            }
            return {
                title:        data.title         || parsed.hostname,
                image:        data.thumbnail_url || null,
                providerName: data.provider_name || ''
            };
        }
        throw new Error(`Response not OK: ${res.status}`);
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        console.warn(`Preview service failed for ${normalizedUrl}:`, e);

        // Fallback to hostname
        return { title: parsed.hostname, image: null, providerName: '' };
    }
};