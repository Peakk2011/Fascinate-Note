import { WebElements } from '../../../../../framework/units.js';
import { theme } from '../theme/colors.js';
import { linkCardShared } from '../theme/linkCardShared.js';

const { spacing } = WebElements;

export const linkCard = `
    .link-card {
        display: flex;
        align-items: center;
        flex-direction: column;

        background: ${theme.light.linkMenuBackground};
        backdrop-filter: blur(${linkCardShared.blur});
        box-shadow: ${theme.light.linkMenuShadow};
        transition: transform 160ms ease, box-shadow 160ms ease;
        cursor: default;
        user-select: none;
        margin: 1.5rem 0;
        margin-bottom: 4rem;

        width: 220px;
        position: relative;
        pointer-events: auto;
    }

    .link-card:hover {
        box-shadow:
            ${theme.light.linkMenuShadow},
            0 4px 12px rgba(0, 0, 0, .08),
            0 16px 40px rgba(0, 0, 0, .12);
    }

    .link-card-thumb {
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;

        box-shadow: ${theme.light.linkMenuShadow};
        border: ${theme.light.linkCardBorder} solid 1px;
        outline: ${theme.light.linkCardBorder} solid 1px;
        pointer-events: none;
    }

    .link-card-thumb img {
        width: 100%;
        height: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        pointer-events: none;
    }

    .link-card-body {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        pointer-events: auto;
        user-select: none;
    }

    .link-card-title {
        font-weight: 600;
        font-size: 1rem;
        margin-top: 0.5rem;
        color: ${theme.light.linkCardText};
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;

        pointer-events: none;
        user-select: none;
        display: none;
    }

    .link-card-badge {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 2px 8px;
        border-radius: 999px;
        background: ${theme.light.linkMenuBackground};
        color: ${theme.light.linkCardText};
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
        border: ${theme.light.linkCardBorder} solid 1px;
        outline: ${theme.light.linkCardBorder} solid 1px;
        backdrop-filter: blur(6px);
        pointer-events: none;
        user-select: none;
    }

    .link-card-open {
        padding: 1rem 0.8rem;
        line-height: 0;
        border-radius: ${linkCardShared.zoomBtnBorderRadius};
        background-color: ${theme.light.linkCardButtonBackground};
        box-shadow: ${theme.light.linkMenuShadow};
        border: ${theme.light.linkCardBorder} solid 1px;
        outline: ${theme.light.linkCardBorder} solid 1px;
        color: ${theme.light.linkCardText};
        width: fit-content;
        display: inline-block;
        text-align: center;
        font-weight: 500;
        letter-spacing: -0.2px;

        cursor: pointer;
        pointer-events: auto;
        text-decoration: none;
        align-self: flex-start;
        user-select: none;

        position: absolute;
        bottom: -40px;
        left: 0;
    }

    .link-card-open:hover {
        background-color: ${theme.light.linkCardHoverBackground};
        cursor: pointer;
        color: ${linkCardShared.zoomBtnHoverColor};
        fill: ${linkCardShared.zoomBtnHoverColor};
        font-weight: ${linkCardShared.zoomBtnHoverWeight};
    }

    .link-card-open {
        color: ${theme.light.linkCardText};
        font-size: 0.85rem;
    }

    .link-card-url-source {
        display: none;
    }

    .link-url-text {
        color: ${theme.light.linkCardText};
        cursor: text;
        border-bottom: solid 1px ${theme.light.linkCardText};
        border-bottom-color: color-mix(in srgb, ${theme.light.linkCardText} 65%, transparent);
        font-weight: 500;
        letter-spacing: -0.4px;
        pointer-events: none;
        user-select: none;
    }

    .inline-url-editor {
        border: 1px solid rgba(0, 0, 0, 0.08);
        padding: 4px 6px;
        border-radius: 6px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
        pointer-events: auto;
    }
`;