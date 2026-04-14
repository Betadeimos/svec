#!/usr/bin/env node

const { intro, outro, text, select, multiselect, spinner, isCancel, cancel, confirm } = require('@clack/prompts');
const pc = require('picocolors');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, execSync } = require('child_process');

let ffmpegPath = 'ffmpeg';

async function setupFFmpeg() {
    const res = spawnSync('ffmpeg', ['-version']);
    if (!res.error) return; // Found in PATH

    try {
        ffmpegPath = require('ffmpeg-static');
        if (ffmpegPath) return; // Local install found
    } catch (e) {} // Not installed locally yet

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
    if (!input) return '';
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

async function main() {
    intro(pc.inverse(' SVEC (Simplest Video Editor CLI) '));

    await setupFFmpeg();

    const cwd = process.cwd();
    const files = fs.readdirSync(cwd);
    const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v'];
    const videoFiles = files.filter(f => videoExts.includes(path.extname(f).toLowerCase()));

    let cleanVideoPath = '';

    if (videoFiles.length > 0) {
        const fileOptions = videoFiles.map(f => ({ value: f, label: f }));
        fileOptions.push({ value: 'manual', label: '✏️  Enter path manually...' });
        
        const selectedFile = await select({
            message: 'Select a video file from the current directory:',
            options: fileOptions
        });

        if (isCancel(selectedFile)) {
            cancel('Operation cancelled.');
            return process.exit(0);
        }

        if (selectedFile === 'manual') {
            const manualPath = await text({
                message: 'Enter the path to the video file:',
                placeholder: './test_video.mp4',
                validate(value) {
                    if (value.trim().length === 0) return 'Path is required';
                    if (!fs.existsSync(value.trim())) return 'File not found at this path';
                }
            });
            if (isCancel(manualPath)) {
                cancel('Operation cancelled.');
                return process.exit(0);
            }
            cleanVideoPath = manualPath.trim();
        } else {
            cleanVideoPath = path.join(cwd, selectedFile);
        }
    } else {
        const videoPath = await text({
            message: 'Enter the path to the video file:',
            placeholder: './test_video.mp4',
            validate(value) {
                if (value.trim().length === 0) return 'Path is required';
                if (!fs.existsSync(value.trim())) return 'File not found at this path';
            }
        });

        if (isCancel(videoPath)) {
            cancel('Operation cancelled.');
            return process.exit(0);
        }
        cleanVideoPath = videoPath.trim();
    }

    const actions = await multiselect({
        message: 'What do you want to do? (Space to select, Enter to confirm)',
        options: [
            { value: 'trim', label: '✂️  Trim Video (set start/end times)' },
            { value: 'resize', label: '📏 Resize Resolution / Reduce File Size' },
            { value: 'codec', label: '🔄 Convert Codec (H.264 / H.265)' }
        ],
        required: true
    });

    if (isCancel(actions)) {
        cancel('Operation cancelled.');
        return process.exit(0);
    }

    let inputArgs = [];
    let outputArgs = [];
    let needsReEncode = actions.includes('resize') || actions.includes('codec');

    // 1. TRIM
    if (actions.includes('trim')) {
        const startTime = await text({
            message: 'Start time (e.g. 8.5s, 1m 8s, 1h 2m, or 00:01:20.50. Leave empty to skip):',
            placeholder: ''
        });
        if (isCancel(startTime)) return process.exit(0);
        if (startTime.trim()) {
            inputArgs.push('-ss', parseTime(startTime));
        }

        const endTime = await text({
            message: 'End time (e.g. 15s, 2m 30s, or 00:05:00.00. Leave empty to skip):',
            placeholder: ''
        });
        if (isCancel(endTime)) return process.exit(0);
        if (endTime.trim()) {
            inputArgs.push('-to', parseTime(endTime));
        }

        if (!needsReEncode) {
            const exactTrim = await select({
                message: 'Do you want to re-encode for precise trimming? (Fast trim copies the stream but may be less accurate on start frames)',
                options: [
                    { value: false, label: 'Fast Trim (No re-encode, extremely fast)' },
                    { value: true, label: 'Precise Trim (Re-encodes video, slower)' }
                ]
            });
            if (isCancel(exactTrim)) return process.exit(0);
            if (exactTrim) {
                needsReEncode = true;
            }
        }
    }

    // 2. RESIZE / REDUCE
    if (actions.includes('resize')) {
        const resolution = await text({
            message: 'New resolution (e.g., 1280x720, -1:720, or leave empty to keep original):',
            placeholder: ''
        });
        if (isCancel(resolution)) return process.exit(0);
        if (resolution.trim()) {
            outputArgs.push('-vf', `scale=${resolution.trim()}`);
        }

        const crf = await text({
            message: 'CRF value for file size reduction (0-51, lower = better quality/bigger size. 28 is standard for smaller files, leave empty to skip):',
            placeholder: '28'
        });
        if (isCancel(crf)) return process.exit(0);
        if (crf.trim()) {
            outputArgs.push('-crf', crf.trim());
        }
    }

    // 3. CODEC
    let chosenCodec = 'libx264'; // Default to highly compatible x264 if re-encoding
    if (actions.includes('codec')) {
        chosenCodec = await select({
            message: 'Select video codec:',
            options: [
                { value: 'libx264', label: 'H.264 / AVC (Most compatible, larger file size)' },
                { value: 'libx265', label: 'H.265 / HEVC (Smaller file size, requires better hardware to play)' }
            ]
        });
        if (isCancel(chosenCodec)) return process.exit(0);
    }
    
    if (needsReEncode) {
        outputArgs.push('-c:v', chosenCodec);
    } else {
        outputArgs.push('-c:v', 'copy');
    }

    // Output path
    const parsedPath = path.parse(cleanVideoPath);
    let editedSuffix = '';
    if (actions.includes('trim')) editedSuffix += '_trim';
    if (actions.includes('resize')) editedSuffix += '_resize';
    if (actions.includes('codec')) editedSuffix += `_${chosenCodec.replace('lib', '')}`;
    if (editedSuffix === '') editedSuffix = '_edited';

    let outputPath = path.join(parsedPath.dir, `${parsedPath.name}${editedSuffix}${parsedPath.ext}`);
    let counter = 1;
    while (fs.existsSync(outputPath)) {
        outputPath = path.join(parsedPath.dir, `${parsedPath.name}${editedSuffix}_${counter}${parsedPath.ext}`);
        counter++;
    }

    const ffmpegArgs = [
        '-y',
        ...inputArgs,
        '-i', cleanVideoPath,
        ...outputArgs,
        '-c:a', 'aac', // Always ensure widely compatible audio format
        outputPath
    ];

    console.log(`\n${pc.cyan('Executing FFmpeg command:')}`);
    console.log(pc.gray(`${ffmpegPath} ${ffmpegArgs.join(' ')}\n`));

    const s = spinner();
    s.start('Processing video...');

    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    ffmpegProcess.stderr.on('data', (data) => {
        const str = data.toString();
        // Match time to update spinner message
        const timeMatch = str.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
        if (timeMatch) {
            s.message(`Processing video... (Time processed: ${timeMatch[1]})`);
        }
        
        // Also match error patterns if needed, though ffmpeg prints standard info to stderr
    });

    ffmpegProcess.on('close', (code) => {
        if (code === 0) {
            s.stop(pc.green(`✅ Done! Saved to: ${outputPath}`));
        } else {
            s.stop(pc.red(`❌ FFmpeg exited with code ${code}`));
            console.error(pc.yellow('\nTip: Make sure FFmpeg is installed and added to your system PATH.'));
        }
        process.exit(code);
    });

    ffmpegProcess.on('error', (err) => {
        s.stop(pc.red(`❌ Failed to start FFmpeg`));
        console.error(pc.red(err.message));
        console.error(pc.yellow('\nTip: Make sure FFmpeg is installed and added to your system PATH.'));
        process.exit(1);
    });
}

main().catch(console.error);
