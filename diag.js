const { spawnSync } = require('child_process');
const fs = require('fs');

console.log('--- SVEC Diagnostics ---');

const ffmpeg = spawnSync('ffmpeg', ['-version']);
console.log(`Global ffmpeg: ${ffmpeg.error ? 'NOT FOUND' : 'FOUND'}`);

const ffprobe = spawnSync('ffprobe', ['-version']);
console.log(`Global ffprobe: ${ffprobe.error ? 'NOT FOUND' : 'FOUND'}`);

try {
    const staticFfmpeg = require('ffmpeg-static');
    console.log(`Static ffmpeg: ${staticFfmpeg && fs.existsSync(staticFfmpeg) ? 'READY' : 'NOT INSTALLED'}`);
} catch (e) {
    console.log('Static ffmpeg: NOT INSTALLED');
}

try {
    const staticFfprobe = require('ffprobe-static');
    console.log(`Static ffprobe: ${staticFfprobe.path && fs.existsSync(staticFfprobe.path) ? 'READY' : 'NOT INSTALLED'}`);
} catch (e) {
    console.log('Static ffprobe: NOT INSTALLED');
}
