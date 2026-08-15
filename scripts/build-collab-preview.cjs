const fs = require('fs');
const path = require('path');

const collabShare = fs.readFileSync(
  path.join('src', 'renderer', 'content', 'pageComponents', 'collabShare.js'),
  'utf8'
);
const css = fs.readFileSync(
  path.join('src', 'stylesheet', 'components', 'collab-share.css'),
  'utf8'
);

// Extract createCollabShareMarkup body
const match = collabShare.match(/export const createCollabShareMarkup = \(\) => `([\s\S]*?)`;/);
if (!match) {
  console.error('cannot extract createCollabShareMarkup');
  process.exit(1);
}
let markup = match[1];

// Replace the OTP loop with a static 6-input markup
const otpReplacement = Array.from({ length: 6 }, (_, i) =>
  `<input id="collab-share-otp-${i}" class="collab-share-otp-input" type="text" inputmode="numeric" pattern="\\d*" maxlength="1" aria-label="Digit ${i + 1}" />`
).join('');
markup = markup.replace(
  /\${Array\.from\(\{ length: ROOM_CODE_LENGTH \}.*?\)\.join\(''\)}/,
  otpReplacement
);

const themeVars = `
  :root {
    --theme-bg: hsl(0, 0%, 7%);
    --theme-fg: #ffffff;
    --theme-border: #3C3C3C;
    --theme-accent: hsl(120, 7%, 85%);
    --theme-accent-text: hsl(120, 7%, 10%);
    --hover-color: #2a2a2a;
    --font-display: Inter, system-ui, sans-serif;
  }
`;

const makeHtml = (activeStep) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>collab-share :: ${activeStep}</title>
  <style>${themeVars} body { background: #2a2a2a; padding: 60px; font-family: Inter, system-ui, sans-serif; } ${css}</style>
</head>
<body>
${markup}
<script>
  setTimeout(() => {
    const root = document.getElementById('collab-share-root');
    const panel = document.getElementById('collab-share-panel');
    const overlay = document.getElementById('collab-share-overlay');
    const modal = document.getElementById('collab-share-modal');
    root.classList.add('is-visible', 'is-open');
    panel.classList.add('is-visible');
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    document.querySelectorAll('.collab-share-step').forEach(s => s.classList.add('hidden'));
    document.getElementById('${activeStep}').classList.remove('hidden');
    const back = document.getElementById('collab-share-back');
    if (back) back.classList.remove('hidden');
  }, 50);
</script>
</body>
</html>
`;

fs.writeFileSync('E:/collab-preview-welcome.html', makeHtml('collab-share-step-welcome'));
fs.writeFileSync('E:/collab-preview-action.html', makeHtml('collab-share-step-action'));
fs.writeFileSync('E:/collab-preview-create.html', makeHtml('collab-share-step-create'));
fs.writeFileSync('E:/collab-preview-join.html', makeHtml('collab-share-step-join'));

console.log('wrote 4 previews');