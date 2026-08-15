/**
 * Profile background color picker.
 * Each entry sets color & style
 * aria-label:  add/remove/reorder colors here only, no markup edits.
 */
export const themeColorSets = {
    themes: [
        { hex: '#F6EACC', label: 'Cream' },
        { hex: '#D1BBA7', label: 'Warm taupe' },
        { hex: '#CDBBA7', label: 'Sandstone' },
        { hex: '#D7B996', label: 'Tan' },
        { hex: '#d2a47d', label: 'Caramel' },

        { hex: '#c1e3b9', label: 'Light green' },
        { hex: '#aeccab', label: 'Sage green' },
        { hex: '#bbdac1', label: 'Mint green' },
        { hex: '#b7d7b3', label: 'Soft green' },
        { hex: '#cadcbc', label: 'Pale green' },

        { hex: '#A6C5DA', label: 'Sky blue' },
        { hex: '#9BB8CD', label: 'Steel blue' },
        { hex: '#90ABC0', label: 'Slate blue' },
        { hex: '#859EB3', label: 'Dusty blue' },
        { hex: '#72879c', label: 'Deep blue' },

        { hex: '#FFC0C0', label: 'Light coral' },
        { hex: '#FFA0A0', label: 'Coral' },
        { hex: '#F68484', label: 'Salmon' },
        { hex: '#EB6F6F', label: 'Red' },
        { hex: '#E05A5A', label: 'Deep red' },

        { hex: '#feeaeb', label: 'Blush' },
        { hex: '#FFD6D6', label: 'Pale pink' },
        { hex: '#f0c8c8', label: 'Dusty pink' },
        { hex: '#d4b6b6', label: 'Muted rose' },
        { hex: '#fcceca', label: 'Peach pink' },
    ],
};

// Fallback default theme background profile color
export const themeDefaultColorSets = '#e5cdcd';

/*
    Renders one <button> per palette entry
    used by workspaceMenu.js
*/
export const renderProfileColorSwatches = () => {
    return themeColorSets.themes.map(
        ({ hex, label }) =>
            `<button type="button" class="collab-share-color-swatch" data-color="${hex}" style="background:${hex};" role="radio" aria-checked="false" aria-label="${label}"></button>`
    ).join('');
};