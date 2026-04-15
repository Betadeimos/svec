const { execSync } = require('child_process');
const fs = require('fs');
let log = '';
try {
    log += execSync('git fetch origin').toString();
    log += execSync('git reset --hard origin/main').toString();
    fs.writeFileSync('sync_log.txt', log);
} catch (e) {
    fs.writeFileSync('sync_log.txt', e.message + '\n' + e.stdout?.toString() + '\n' + e.stderr?.toString());
}
