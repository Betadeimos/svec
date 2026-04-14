#!/usr/bin/env node

const { intro, outro, text, select, multiselect, spinner, isCancel, cancel, confirm } = require('@clack/prompts');
const pc = require('picocolors');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, execSync } = require('child_process');

let ffmpegPath = 'ffmpeg';

async function setupFFmpeg() {
    const res = spawnSync('ffmpeg', ['-version']);
    if (!res.error) return;

    try {
        ffmpegPath = require('ffmpeg-static');
        if (ffmpegPath) return;
    } catch (e) {}

    const shouldInstall = await confirm({
        message: 'FFmpeg was not found in your system PATH. Should SVEC install a local copy automatically?'
    });

    if (isCancel(shouldInstall) || !shouldInstall) {
        console.error(pc.red('FFmpeg is required to run SVEC. Please install it manually and add it to your PATH.'));
        process.exit(1);
    }

    const s = spinner();
    s.start('Installing local FFmpeg (this might take a minute)...');
    try {
        execSync('npm install ffmpeg-static', { stdio: 'ignore' });
        ffmpegPath = require('ffmpeg-static');
        s.stop(pc.green('✅ Local FFmpeg installed successfully!'));
    } catch (err) {
        s.stop(pc.red('❌ Failed to install FFmpeg'));
        console.error(pc.red(err.message));
        process.exit(1);
    }
}

function parseTime(input) {
    if (!input || input.trim() === '') return '0';
    input = input.trim().toLowerCase();
    if (input.includes(':')) return input;
    
    let seconds = 0;
    let matched = false;
    const hMatch = input.match(/([\d.]+)h/);
    const mMatch = input.match(/([\d.]+)m/);
    const sMatch = input.match(/([\d.]+)s/);
    
    if (hMatch) { seconds += parseFloat(hMatch[1]) * 3600; matched = true; }
    if (mMatch) { seconds += parseFloat(mMatch[1]) * 60; matched = true; }
    if (sMatch) { seconds += parseFloat(sMatch[1]); matched = true; }
    
    if (!matched && !isNaN(parseFloat(input))) {
        seconds = parseFloat(input);
        matched = true;
    }
    
    return matched ? seconds.toString() : input;
}

function getMetadata(filePath) {
    let ffprobePath = ffmpegPath.replace('ffmpeg', 'ffprobe');
    if (process.platform === 'win32' && !ffprobePath.endsWith('.exe') && ffmpegPath.endsWith('.exe')) {
        ffprobePath += '.exe';
    }

    try {
        const result = spawnSync(ffprobePath, [
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height,duration,display_aspect_ratio',
            '-of', 'json',
            filePath
        ]);
        const data = JSON.parse(result.stdout.toString());
        const stream = data.streams[0];
        return {
            width: stream.width,
            height: stream.height,
            duration: parseFloat(stream.duration).toFixed(1),
            aspect: stream.display_aspect_ratio || `${(stream.width/stream.height).toFixed(2)}:1`
        };
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log(pc.cyan(`
   _____ __      ________ _____ 
  / ____|\\ \\    / /  ____/ ____|
 | (___   \\ \\  / /| |__ | |     
  \\___ \\   \\ \\/ / |  __|| |     
  ____) |   \\  /  | |___| |____ 
 |_____/     \\/   |______\\_____|
`));
    console.log(pc.gray('   Simplest Video Editor CLI'));
    console.log(pc.gray('   ━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    await setupFFmpeg();

    let sessionActive = true;
    while (sessionActive) {
        const cwd = process.cwd();
        const files = fs.readdirSync(cwd);
        const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v'];
        const videoFiles = files.filter(f => videoExts.includes(path.extname(f).toLowerCase()));

        let cleanVideoPath = '';
        if (videoFiles.length > 0) {
            const fileOptions = videoFiles.map(f => ({ value: f, label: f }));
            fileOptions.push({ value: 'manual', label: '✏️  Enter path or Drag & Drop file...' });
            const selectedFile = await select({ message: 'Select a video file:', options: fileOptions });
            if (isCancel(selectedFile)) break;
            if (selectedFile === 'manual') {
                const manualPath = await text({
                    message: 'Path/Drag & Drop file:',
                    validate(v) {
                        let p = (v || '').trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
                        if (!fs.existsSync(p)) return 'File not found';
                    }
                });
                if (isCancel(manualPath)) break;
                cleanVideoPath = manualPath.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
            } else {
                cleanVideoPath = path.join(cwd, selectedFile);
            }
        } else {
            const videoPath = await text({
                message: 'Path/Drag & Drop file:',
                validate(v) {
                    let p = (v || '').trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
                    if (!fs.existsSync(p)) return 'File not found';
                }
            });
            if (isCancel(videoPath)) break;
            cleanVideoPath = videoPath.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
        }

        const meta = getMetadata(cleanVideoPath);
        if (meta) {
            console.log(pc.blue(`\n  🎞️  Current Video: ${pc.bold(meta.width + 'x' + meta.height)} | Aspect: ${pc.bold(meta.aspect)} | Duration: ${pc.bold(meta.duration + 's')}\n`));
        } else {
            console.log(pc.yellow('\n  ⚠️  Could not read video metadata (duration/resolution may be unavailable).\n'));
        }

        const actions = await multiselect({
            message: 'Select actions:',
            options: [
                { value: 'trim', label: '✂️  Trim Video' },
                { value: 'resize', label: '📏 Resize / Aspect Ratio' },
                { value: 'codec', label: '🔄 Change Codec' },
                { value: 'container', label: '📦 Change Format/Extension' }
            ],
            required: true
        });
        if (isCancel(actions)) break;

        let inputArgs = [];
        let outputArgs = [];
        let videoFilters = [];
        let needsReEncode = actions.includes('resize') || actions.includes('codec');

        if (actions.includes('trim')) {
            const durationLabel = meta ? `Duration: ${meta.duration}s, ` : '';
            const startStr = await text({ message: `Start time (${durationLabel}empty = 0s):` });
            if (isCancel(startStr)) break;
            const endStr = await text({ message: 'End time (empty = end of video):' });
            if (isCancel(endStr)) break;
            
            const startVal = (startStr || '').trim();
            const endVal = (endStr || '').trim();

            if (startVal !== '' || endVal !== '') {
                inputArgs.push('-ss', parseTime(startVal || '0'));
                if (endVal) inputArgs.push('-to', parseTime(endVal));
            }

            if (!needsReEncode) {
                const exactTrim = await select({
                    message: 'Do you want to re-encode for precise trimming?\n  (Fast trim copies the stream but may be less accurate\n   on the start frames of the trim)',
                    options: [
                        { value: false, label: 'Fast Trim (No re-encode, extremely fast)' },
                        { value: true, label: 'Precise Trim (Re-encodes video, slower)' }
                    ]
                });
                if (isCancel(exactTrim)) break;
                if (exactTrim) needsReEncode = true;
            }
        }

        let resizeParams = null;
        if (actions.includes('resize')) {
            needsReEncode = true;
            const aspect = await select({
                message: 'Select Target Aspect Ratio:',
                options: [
                    { value: 'skip', label: 'Keep Original' },
                    { value: '16:9', label: '16:9 (Wide)' }, 
                    { value: '9:16', label: '9:16 (Vertical)' },
                    { value: '1:1', label: '1:1 (Square)' }, 
                    { value: '4:3', label: '4:3 (Old TV)' },
                    { value: 'custom', label: 'Custom Aspect Ratio' }
                ]
            });
            if (isCancel(aspect)) break;

            let finalAspect = aspect;
            if (aspect === 'custom') {
                finalAspect = await text({ message: 'Enter aspect (e.g. 21:9):' });
                if (isCancel(finalAspect)) break;
            }

            let logic = 'stretch';
            let padColor = 'black';
            
            if (finalAspect !== 'skip') {
                logic = await select({
                    message: 'Resize Logic:\n  Fit: Add bars to keep whole image\n  Fill: Crop edges to fill screen\n  Stretch: Distort image to fit',
                    options: [
                        { value: 'fit', label: 'Fit (Padding)' },
                        { value: 'crop', label: 'Fill (Crop)' },
                        { value: 'stretch', label: 'Stretch' }
                    ]
                });
                if (isCancel(logic)) break;

                if (logic === 'fit') {
                    padColor = await select({
                        message: 'Padding Color:',
                        options: [{ value: 'black', label: 'Black' }, { value: 'white', label: 'White' }, { value: 'custom', label: 'Custom Hex/RGB' }]
                    });
                    if (isCancel(padColor)) break;
                    if (padColor === 'custom') {
                        padColor = await text({ message: 'Enter color (e.g. #FF0000):' });
                        if (isCancel(padColor)) break;
                    }
                }
            }

            const resScale = await select({
                message: 'Select Size:',
                options: [
                    { value: '720', label: '720p (HD)' },
                    { value: '1080', label: '1080p (Full HD)' }, 
                    { value: '2160', label: '2160p (4K)' }, 
                    { value: 'custom', label: 'Custom Pixel Size' }
                ]
            });
            if (isCancel(resScale)) break;

            let tw, th;
            if (resScale === 'custom') {
                const customRes = await text({ 
                    message: 'Enter resolution (WIDTH:HEIGHT, e.g. 1920:1080):',
                    validate(v) { if (!(v || '').includes(':')) return 'Use COLON (:) e.g. 1920:1080'; }
                });
                if (isCancel(customRes)) break;
                [tw, th] = customRes.split(':');
            } else {
                const S = parseInt(resScale);
                if (finalAspect === 'skip') {
                    // Smart auto-scale based on original orientation
                    const isTall = meta && (parseInt(meta.height) > parseInt(meta.width));
                    if (isTall) { tw = S; th = '-2'; } else { tw = '-2'; th = S; }
                } else {
                    const [aw, ah] = finalAspect.split(':').map(Number);
                    const ratio = aw / ah;
                    if (ratio >= 1) { 
                        tw = Math.round(S * ratio); 
                        th = S; 
                    } else { 
                        tw = S; 
                        th = Math.round(S / ratio); 
                    }
                    // Ensure even numbers for codecs
                    if (tw % 2 !== 0) tw++;
                    if (th % 2 !== 0) th++;
                }
            }

            if (finalAspect === 'skip') {
                videoFilters.push(`scale=${tw}:${th}`);
            } else if (logic === 'stretch') {
                videoFilters.push(`scale=${tw}:${th},setsar=1:1`);
            } else if (logic === 'fit') {
                videoFilters.push(`scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:${padColor},setsar=1:1`);
            } else if (logic === 'crop') {
                videoFilters.push(`scale=${tw}:${th}:force_original_aspect_ratio=increase,crop=${tw}:${th},setsar=1:1`);
            }
        }

        let chosenCodec = 'libx264';
        if (actions.includes('codec')) {
            needsReEncode = true;
            chosenCodec = await select({
                message: 'Codec:',
                options: [{ value: 'libx264', label: 'H.264' }, { value: 'libx265', label: 'H.265' }]
            });
            if (isCancel(chosenCodec)) break;
        }

        let targetExt = path.extname(cleanVideoPath);
        if (actions.includes('container')) {
            targetExt = await select({
                message: 'Format:',
                options: [{ value: '.mp4', label: '.mp4' }, { value: '.mkv', label: '.mkv' }, { value: '.mov', label: '.mov' }, { value: '.gif', label: '.gif' }, { value: 'custom', label: 'Custom' }]
            });
            if (isCancel(targetExt)) break;
            if (targetExt === 'custom') {
                targetExt = await text({ message: 'Extension (.ext):' });
                if (isCancel(targetExt)) break;
            }
        }

        if (targetExt === '.gif') {
            needsReEncode = true;
            videoFilters.push('fps=15', 'scale=480:-1:flags=lanczos');
        }

        if (needsReEncode) {
            let sizeEstimate = '';
            if (meta && meta.duration) {
                // Extremely rough estimation logic
                // Very Low (CRF 45): ~0.1 MB/s
                // Balanced (CRF 26): ~0.5 MB/s
                // Very High (CRF 10): ~5.0 MB/s
                const d = parseFloat(meta.duration);
                const est1 = (d * 0.1).toFixed(1);
                const est5 = (d * 0.5).toFixed(1);
                const est10 = (d * 5.0).toFixed(1);
                sizeEstimate = `\n  ${pc.gray(`Rough Est. Size: 1≈${est1}MB | 5≈${est5}MB | 10≈${est10}MB`)}`;
            }

            const quality = await select({
                message: `Output Quality (1-10):${sizeEstimate}`,
                options: Array.from({length: 10}, (_, i) => {
                    const level = i + 1;
                    let desc = '';
                    if (level === 1) desc = ' (Smallest file, lowest quality)';
                    if (level === 5) desc = ' (Balanced)';
                    if (level === 10) desc = ' (Largest file, highest quality)';
                    return { value: level.toString(), label: `${level}${desc}` };
                })
            });
            if (isCancel(quality)) break;
            const crfMap = { '1': 45, '2': 40, '3': 35, '4': 30, '5': 26, '6': 23, '7': 20, '8': 18, '9': 14, '10': 10 };
            outputArgs.push('-c:v', chosenCodec, '-crf', crfMap[quality].toString());
        } else {
            outputArgs.push('-c:v', 'copy');
        }

        if (videoFilters.length > 0) outputArgs.push('-vf', videoFilters.join(','));

        const parsed = path.parse(cleanVideoPath);
        let editedSuffix = (actions.includes('trim') ? '_trim' : '') + (actions.includes('resize') ? '_resize' : '') + (actions.includes('container') ? '_converted' : '');
        if (!editedSuffix) editedSuffix = '_edited';

        let outputPath = path.join(parsed.dir, `${parsed.name}${editedSuffix}${targetExt}`);
        let c = 1; while (fs.existsSync(outputPath)) { outputPath = path.join(parsed.dir, `${parsed.name}${editedSuffix}_${c++}${targetExt}`); }

        const ffmpegArgs = ['-y', ...inputArgs, '-i', cleanVideoPath, ...outputArgs];
        if (targetExt === '.gif') ffmpegArgs.push('-an'); else ffmpegArgs.push('-c:a', 'aac');
        ffmpegArgs.push(outputPath);

        const s = spinner();
        let taskLabel = 'Processing';
        if (actions.length === 1) {
            const a = actions[0];
            if (a === 'trim') taskLabel = 'Trimming video';
            else if (a === 'resize') taskLabel = 'Resizing video';
            else if (a === 'codec') taskLabel = 'Converting codec';
            else if (a === 'container') taskLabel = 'Converting format';
        } else {
            const labels = actions.map(a => {
                if (a === 'trim') return 'Trimming';
                if (a === 'resize') return 'Resizing';
                if (a === 'codec') return 'Transcoding';
                if (a === 'container') return 'Converting';
                return a;
            });
            taskLabel = labels.join(', ').replace(/, ([^,]*)$/, ' & $1');
        }
        s.start(`${taskLabel}...`);
        
        await new Promise((resolve, reject) => {
            const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
            let lastUpdate = 0;
            ffmpegProcess.stderr.on('data', (data) => {
                const now = Date.now();
                if (now - lastUpdate < 1000) return;
                const match = data.toString().match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
                if (match) { s.message(`${taskLabel}... (Time: ${pc.yellow(match[1])})`); lastUpdate = now; }
            });
            ffmpegProcess.on('close', (code) => {
                if (code === 0) { s.stop(pc.green(`✅ Done! Saved to: ${outputPath}`)); resolve(); }
                else { s.stop(pc.red(`❌ Failed (Code ${code})`)); reject(); }
            });
            ffmpegProcess.on('error', (err) => { s.stop(pc.red(`❌ Error starting FFmpeg`)); reject(err); });
        });

        const more = await confirm({ message: 'Edit another video?', initialValue: true });
        if (isCancel(more) || !more) sessionActive = false;
        console.log('\n');
    }
    outro(pc.inverse(' Thank you for using SVEC! '));
}

main().catch(console.error);
