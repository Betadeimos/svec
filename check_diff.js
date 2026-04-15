const { execSync } = require('child_process');
const fs = require('fs');
try {
    const diff = execSync('git diff index.js').toString();
    fs.writeFileSync('diff.txt', diff);
} catch (e) {
    fs.writeFileSync('diff.txt', e.message);
}
