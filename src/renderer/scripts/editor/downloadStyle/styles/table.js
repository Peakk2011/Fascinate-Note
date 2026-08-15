import { WebElements, Design } from '../../../../../framework/units.js';
import { theme } from '../theme/colors.js';

const { spacing } = WebElements;
const { designConfig } = Design;

export const table = `
    table {
        border-collapse: ${designConfig.borderCollapse};
        width: 100%;
        margin-bottom: ${spacing[6]};
    }

    th, td {
        border: 1px solid ${theme.light.border};
        padding: ${spacing[2]} ${spacing[3]};
        text-align: left;
    }

    th {
        background: ${theme.light.codeBg};
        font-weight: 600;
    }
`;