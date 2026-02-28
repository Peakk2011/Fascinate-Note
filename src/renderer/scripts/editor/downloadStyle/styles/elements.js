import { WebElements, Design } from '../../../../../framework/units.js';
import { theme } from '../theme/colors.js';

const { spacing, borderRadius } = WebElements;
const { designConfig } = Design;

export const elements = `
    a {
        color: ${theme.light.links};
        text-decoration: ${designConfig.textDecorationNone};
        transition: color 150ms ease;
        border-bottom: solid 1px currentColor;
    }

    a:hover, a:focus {
        color: ${theme.light.muted};
    }

    code {
        background: ${theme.light.codeBg};
        padding: ${spacing[0.5]} ${spacing[1]};
        border-radius: ${borderRadius.sm};
        font-family: Consolas, Monaco, 'Courier New', monospace;
        font-size: 0.95em;
    }

    pre {
        background: ${theme.light.codeBg};
        padding: ${spacing[4]};
        border-radius: ${borderRadius.md};
        overflow-x: auto;
        margin: 0 0 ${spacing[6]};
    }

    pre code {
        background: ${designConfig.backgroundNone};
        padding: 0;
        border-radius: 0;
    }

    blockquote {
        border-left: 4px solid ${theme.light.border};
        margin: 0 0 ${spacing[6]};
        padding-left: ${spacing[4]};
        color: ${theme.light.muted};
        font-style: italic;
    }

    ul, ol {
        margin: ${spacing[4]} 0 ${spacing[6]} ${spacing[6]};
        padding: 0;
    }

    li {
        margin-bottom: ${spacing[2]};
    }

    li > ul, li > ol {
        margin-top: ${spacing[2]};
    }

    hr {
        border: ${designConfig.borderNone};
        border-top: 1px solid ${theme.light.border};
    }

    img, video, audio, iframe, embed, object {
        max-width: 100%;
        height: ${designConfig.heightAuto};
        display: ${designConfig.displayBlock};
        margin: ${spacing[4]} auto;
    }

    input[type="checkbox"],
    input[type="radio"] {
        width: ${spacing[4]};
        height: ${spacing[4]};
        margin-right: ${spacing[2]};
        transform: translateY(1.5px);
    }

    figcaption {
        font-size: 0.875rem;
        text-align: center;
        margin-top: ${spacing[2]};
        font-style: italic;
    }
`;