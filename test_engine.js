const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pc = require('picocolors');

// Get FFmpeg (required)
let ffmpegPath;
try {
    ffmpegPath = require('ffmpeg-static');
} catch (e) {
    console.error(pc.red('❌ ffmpeg-static not installed. Run: npm install'));
    process.exit(1);
}

// Get FFprobe (optional for tests)
let ffprobePath = null;
// First check system PATH
const ffprobeRes = spawnSync('ffprobe', ['-version']);
if (!ffprobeRes.error) {
    ffprobePath = 'ffprobe';
    console.log(pc.dim('Using ffprobe from system PATH'));
} else {
    // Fall back to static binary
    try {
        ffprobePath = require('ffprobe-static').path;
        if (ffprobePath && fs.existsSync(ffprobePath)) {
            console.log(pc.dim('Using ffprobe-static binary'));
        } else {
            ffprobePath = null;
            console.log(pc.yellow('⚠️  ffprobe not available. Metadata validation will be skipped.'));
        }
    } catch (e) {
        ffprobePath = null;
        console.log(pc.yellow('⚠️  ffprobe not available. Metadata validation will be skipped.'));
    }
}

const TEST_VIDEO = 'test_footage.mp4';
const OUTPUT_DIR = 'test_output';

if (!fs.existsSync(TEST_VIDEO)) {
    console.log(pc.yellow(`⚠️  ${TEST_VIDEO} not found. Creating test video...`));
    const result = spawnSync(ffmpegPath, [
        '-f', 'lavfi', '-i', 'testsrc=duration=5:size=1920x1080:rate=30',
        '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=5',
        '-pix_fmt', 'yuv420p', '-y', TEST_VIDEO
    ]);
    if (result.status !== 0 || !fs.existsSync(TEST_VIDEO)) {
        console.error(pc.red('❌ Failed to create test video. Please provide test_footage.mp4 manually.'));
        process.exit(1);
    }
    console.log(pc.green('✅ Test video created'));
}

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

function getMetadata(filePath) {
    if (!ffprobePath) return null;
    try {
        const result = spawnSync(ffprobePath, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration', '-of', 'json', filePath]);
        return JSON.parse(result.stdout.toString()).streams[0];
    } catch (e) { return null; }
}

async function runTest(name, args, validator = null) {
    const start = Date.now();
    const cleanName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const outPath = path.join(OUTPUT_DIR, `test_${cleanName}.mp4`);
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

    const inputArgs = [];
    const internalArgs = [...args];
    
    const ssIndex = internalArgs.indexOf('-ss');
    if (ssIndex !== -1) {
        inputArgs.push(internalArgs[ssIndex], internalArgs[ssIndex+1]);
        internalArgs.splice(ssIndex, 2);
    }
    
    const fullArgs = ['-y', ...inputArgs, '-i', TEST_VIDEO, ...internalArgs, outPath];
    const result = spawnSync(ffmpegPath, fullArgs);
    const end = Date.now();
    const duration = ((end - start) / 1000).toFixed(2);

    if (result.status === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
        // Skip metadata validation if ffprobe is not available
        if (!ffprobePath) {
            console.log(`${pc.green('✔')} ${pc.bold(name)} - ${pc.yellow(duration + 's')} ${pc.dim('(metadata check skipped)')}`);
            return { success: true };
        }
        
        const meta = getMetadata(outPath);
        if (!meta) {
            console.log(`${pc.red('✘')} ${pc.bold(name)} - ${pc.red('NO VIDEO STREAM')}`);
            return { success: false };
        }

        if (validator) {
            const error = validator(meta, outPath);
            if (error) {
                console.log(`${pc.red('✘')} ${pc.bold(name)} - ${pc.red('VALIDATION FAILED: ' + error)}`);
                return { success: false };
            }
        }

        console.log(`${pc.green('✔')} ${pc.bold(name)} - ${pc.yellow(duration + 's')}`);
        return { success: true, meta, outPath };
    } else {
        console.log(`${pc.red('✘')} ${pc.bold(name)} - ${pc.red('FAILED (Empty or Error)')}`);
        return { success: false };
    }
}

function checkAudio(filePath) {
    if (!ffprobePath) return null;
    const res = spawnSync(ffprobePath, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'json', filePath]);
    try {
        const data = JSON.parse(res.stdout.toString());
        return data.streams && data.streams.length > 0 ? data.streams[0].codec_name : null;
    } catch (e) { return null; }
}

async function main() {
    console.log(pc.cyan('\n🚀 Starting SVEC Exhaustive Engine Tests\n'));
    
    const results = [];

    // 1. Precise Trim + Transcode
    results.push(await runTest('Precise Trim (2s)', ['-ss', '0.5', '-t', '2', '-c:v', 'libx264'], (meta) => {
        if (parseFloat(meta.duration) > 2.5) return `Duration too long (${meta.duration}s)`;
    }));

    // 2. Resize Fit (Padding) - Testing 16:9 into 1:1
    results.push(await runTest('Resize Fit (1:1 Pad)', ['-vf', 'scale=720:720:force_original_aspect_ratio=decrease,pad=720:720:(ow-iw)/2:(oh-ih)/2:black,setsar=1:1', '-c:v', 'libx264'], (meta) => {
        if (meta.width !== 720 || meta.height !== 720) return `Wrong resolution ${meta.width}x${meta.height}`;
    }));

    // 3. Resize Fill (Crop)
    results.push(await runTest('Resize Fill (9:16 Crop)', ['-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1:1', '-c:v', 'libx264'], (meta) => {
        if (meta.width !== 720 || meta.height !== 1280) return `Wrong resolution ${meta.width}x${meta.height}`;
    }));

    // 4. Codec: H.265 (HEVC)
    results.push(await runTest('Codec H.265', ['-c:v', 'libx265', '-crf', '28', '-t', '1'], (meta) => {
        // Verify codec via ffprobe
        const res = spawnSync(ffprobePath, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'json', path.join(OUTPUT_DIR, 'test_codec_h_265.mp4')]);
        const codec = JSON.parse(res.stdout.toString()).streams[0].codec_name;
        if (codec !== 'hevc') return `Wrong codec: ${codec}`;
    }));

    // 5. Audio: Remove
    results.push(await runTest('Audio: Remove', ['-an', '-t', '1'], (meta, path) => {
        if (checkAudio(path)) return 'Audio stream still exists';
    }));

    // 6. Audio: Convert to AAC
    results.push(await runTest('Audio: Convert AAC', ['-c:a', 'aac', '-t', '1'], (meta, path) => {
        const codec = checkAudio(path);
        if (codec !== 'aac') return `Wrong audio codec: ${codec}`;
    }));

    // 7. Format: MKV Container
    const mkvPath = path.join(OUTPUT_DIR, 'test_format_mkv.mkv');
    if (fs.existsSync(mkvPath)) fs.unlinkSync(mkvPath);
    const mkvRes = spawnSync(ffmpegPath, ['-y', '-i', TEST_VIDEO, '-t', '1', '-c', 'copy', mkvPath]);
    if (mkvRes.status === 0 && fs.existsSync(mkvPath)) {
        console.log(`${pc.green('✔')} ${pc.bold('Format: MKV Container')} - ${pc.yellow('OK')}`);
    } else {
        console.log(`${pc.red('✘')} ${pc.bold('Format: MKV Container')} - ${pc.red('FAILED')}`);
        results.push({ success: false });
    }

    // Summary
    const allPassed = results.every(r => r.success !== false);
    if (allPassed) {
        console.log(pc.green('\n✅ ALL EXHAUSTIVE TESTS PASSED!\n'));
    } else {
        console.log(pc.red('\n❌ SOME TESTS FAILED. Check logs above.\n'));
        process.exit(1);
    }
}

main();
