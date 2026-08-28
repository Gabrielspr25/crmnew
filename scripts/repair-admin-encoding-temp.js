const fs = require('fs');

const file = 'frontend/app.html';
let text = fs.readFileSync(file, 'utf8');

const replacements = {
  'Ã¡': '\u00e1',
  'Ã©': '\u00e9',
  'Ã­': '\u00ed',
  'Ã³': '\u00f3',
  'Ãº': '\u00fa',
  'Ã±': '\u00f1',
  'Ã‘': '\u00d1',
  'Ã¼': '\u00fc',
  'Â¿': '\u00bf',
  'Â¡': '\u00a1',
  'Â·': '\u00b7',
  'Âº': '\u00ba',
  'Âª': '\u00aa',
  'â€¦': '\u2026',
  'â€”': '\u2014',
  'â€“': '\u2013',
  'â†’': '\u2192',
  'â†—': '\u2197',
  'â¬‡': '\u2b07',
  'âœ“': '\u2713',
  'âœ•': '\u2715',
  'â–¾': '\u25be',
  'â–¸': '\u25b8',
  'âš ': '\u26a0',
  'âš¡': '\u26a1',
  'â¤´': '\u2934',
  'âœ‰': '\u2709',
  'âœŽ': '\u270e',
  'â‡ª': '\u21ea',
  'â‡„': '\u21c4',
  'â¹': '\u23f9',
  'â˜Ž': '\u260e',
  'âš™': '\u2699',
  'â†‘': '\u2191',
  'â†“': '\u2193',
  'â€¢': '\u2022',
  'â†': '\u2190',
  'â†»': '\u21bb',
  'â¬†ï¸': '\u2b06\ufe0f',
  'Ãš': '\u00da',
  'Ã“N': '\u00d3',
  'Ã—': '\u00d7',
  'ðŸ“Š': '\ud83d\udcca',
  'ðŸ”Ž': '\ud83d\udd0e',
  'ðŸ“¥': '\ud83d\udce5',
  'ðŸ“„': '\ud83d\udcc4',
  'ðŸ“±': '\ud83d\udcf1',
  'ðŸ’¬': '\ud83d\udcac',
  'ðŸ”�': '\ud83d\udd0d',
  'Â': ''
};

for (const [bad, good] of Object.entries(replacements)) {
  text = text.split(bad).join(good);
}

fs.writeFileSync(file, text, 'utf8');
console.log('badCount', (text.match(/[ÃÂâ]/g) || []).length);
console.log('controlCount', (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length);
