import { WebElements, Design } from '../../../../../framework/units.js';
import { theme } from '../theme/colors.js';

const { spacing } = WebElements;
const { designConfig } = Design;

export const base = `
    @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&family=Anuphan:wght@400;600;700&display=swap');

    *, *::before, *::after {
        box-sizing: ${designConfig.boxSizing || 'border-box'};
        margin: 0;
        padding: 0;
    }

    html {
        -webkit-text-size-adjust: ${designConfig.textSizeAdjust};
    }

    body {
        font-family: "Inter Tight", "Leelawadee UI", system-ui, sans-serif;
        line-height: ${designConfig.lineHeight};
        -webkit-font-smoothing: ${designConfig.fontSmoothingWebkit};
        -moz-osx-font-smoothing: ${designConfig.fontSmoothingMoz};
        text-rendering: ${designConfig.textRendering};
        max-width: 750px;
        margin: 0 auto;
        padding: ${spacing[6]};
        color: ${theme.light.text};
        background: ${theme.light.background};
    }

    @media (max-width: 768px) {
        body {
            max-width: 100%;
            padding: ${spacing[6]};
        }
    }

    div, p, span {
        font-family: "Inter Tight", "Leelawadee UI", system-ui, sans-serif;
    }

    h1, h2, h3, h4, h5, h6 {
        font-family: 'Inter Tight', 'Anuphan', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        margin-top: ${spacing[4]};
        margin-bottom: ${spacing[4]};
        font-weight: 600;
        line-height: ${designConfig.headingLineHeight};
        letter-spacing: ${designConfig.letterSpacing};
    }

    h1 { font-size: 27.9px; }
    h2 { font-size: 21.75px; }
    h3 { font-size: 16.965px; }
    h4 { font-size: 14.5px; }
    h5 { font-size: 14.5px; }
    h6 { font-size: 14.5px; }
`;