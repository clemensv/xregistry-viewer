const fs = require('fs');
const path = require('path');

const stylesPath = path.join(__dirname, '..', 'src', 'styles.scss');

// Read the styles file
let content = fs.readFileSync(stylesPath, 'utf8');

// Replace map.get(theme.$background-color, key) with theme.bg('key')
content = content.replace(/map\.get\(theme\.\$background-color,\s*([a-zA-Z0-9_-]+)\)/g, "theme.bg('$1')");

// Replace map.get(theme.$foreground-color, key) with theme.fg('key')
content = content.replace(/map\.get\(theme\.\$foreground-color,\s*([a-zA-Z0-9_-]+)\)/g, "theme.fg('$1')");

// Write the updated content back to the file
fs.writeFileSync(stylesPath, content);

console.log('SCSS files updated successfully!');
