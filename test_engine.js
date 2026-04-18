import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { setupFFmpeg, getFFmpegPath, getMetadata } from './lib/binaries.js';
import { executeFFmpeg } from './lib/processor.js';

const TEST_VIDEO = 'test_footage.mp4';
const OUTPUT_DIR = 'test_output';

async function createTestVideo(ffmpegPath) {
    if (fs.existsSync(TEST_VIDEO)) return;
    
    console.log(pc.yellow(`⚠️  ${TEST_VIDEO} not found. Creating test video...`));
    const result = spawnSync(ffmpegPath, [
        '-f', 'lavfi', '-i', 'testsrc=duration=5:size=1920x1080:rate=30',
        '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=5',
        '-pix_fmt', 'yuv420p', '-y', TEST_VIDEO
    ]);
    
    if (result.status !== 0 || !fs.existsSync(TEST_VIDEO)) {
        console.error(pc.red('❌ Failed to create test video.'));
        process.exit(1);
    }
    console.log(pc.green('✅ Test video created\n'));
}

async function runTestCase(name, config) {
    console.log(pc.cyan(`▶ Testing: ${name}...`));
    try {
        const outPath = await executeFFmpeg(config, getFFmpegPath());
        
        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
            console.log(pc.green(`✔ ${name} PASSED`));
            const meta = getMetadata(outPath);
            if (meta) {
                console.log(pc.dim(`  Result: ${meta.width}x${meta.height} | ${meta.duration}s | ${meta.aspect}`));
            }
            return true;
        } else {
            console.log(pc.red(`✘ ${name} FAILED (File empty or missing)`));
            return false;
        }
    } catch (err) {
        console.log(pc.red(`✘ ${name} FAILED (Error: ${err.message})`));
        return false;
    }
}

async function main() {
    console.log(pc.bold(pc.magenta('\n🚀 SVEC ENGINE AUTOMATED TEST SUITE\n')));
    
    await setupFFmpeg();
    const ffmpegPath = getFFmpegPath();
    await createTestVideo(ffmpegPath);

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
    } else {
        // Clear old test outputs to ensure new files overwrite properly
        fs.readdirSync(OUTPUT_DIR).forEach(f => fs.unlinkSync(path.join(OUTPUT_DIR, f)));
    }

    const tests = [
        {
            name: "1. MP4 + libx264 + AAC + Fit + 16:9 + 720p + Trim",
            config: {
                videoPath: path.resolve(TEST_VIDEO),
                outputPath: path.resolve(OUTPUT_DIR, "test1_mp4_h264_aac_fit_16x9_720p_trim.mp4"),
                actions: ['trim', 'resize', 'codec', 'container'],
                trim: { start: "00:00", end: "00:02" },
                resize: { logic: "fit", padColor: "black", tw: "1280", th: "720", finalAsp: "16:9" },
                targetExt: ".mp4",
                codec: "libx264",
                audio: "aac",
                quality: "5"
            }
        },
        {
            name: "2. MOV + ProRes + Copy Audio + Crop + 1:1 + 1080p",
            config: {
                videoPath: path.resolve(TEST_VIDEO),
                outputPath: path.resolve(OUTPUT_DIR, "test2_mov_prores_copy_crop_1x1_1080p.mov"),
                actions: ['trim', 'resize', 'codec', 'container'],
                trim: { start: "00:00", end: "00:01" }, // short to save time
                resize: { logic: "crop", padColor: "black", tw: "1080", th: "1080", finalAsp: "1:1" },
                targetExt: ".mov",
                codec: "prores",
                audio: "copy",
                quality: "5"
            }
        },
        {
            name: "3. WEBM + VP9 + Remove Audio + Stretch + 9:16 + 4K",
            config: {
                videoPath: path.resolve(TEST_VIDEO),
                outputPath: path.resolve(OUTPUT_DIR, "test3_webm_vp9_remove_stretch_9x16_4k.webm"),
                actions: ['trim', 'resize', 'codec', 'container'],
                trim: { start: "00:00", end: "00:01" }, // short to save time
                resize: { logic: "stretch", padColor: "black", tw: "2160", th: "3840", finalAsp: "9:16" }, 
                targetExt: ".webm",
                codec: "libvpx-vp9",
                audio: "remove",
                quality: "5"
            }
        },
        {
            name: "4. MKV + libx265 + AAC + Fit + 4:3 + Custom Res (800x600)",
            config: {
                videoPath: path.resolve(TEST_VIDEO),
                outputPath: path.resolve(OUTPUT_DIR, "test4_mkv_x265_aac_fit_4x3_800x600.mkv"),
                actions: ['trim', 'resize', 'codec', 'container'],
                trim: { start: "00:00", end: "00:01" },
                resize: { logic: "fit", padColor: "black", tw: "800", th: "600", finalAsp: "4:3" },
                targetExt: ".mkv",
                codec: "libx265",
                audio: "aac",
                quality: "5"
            }
        },
        {
            name: "5. AVI + Copy Codec + Copy Audio + Trim",
            config: {
                videoPath: path.resolve(TEST_VIDEO),
                outputPath: path.resolve(OUTPUT_DIR, "test5_avi_copy_copy_trim.avi"),
                actions: ['trim', 'container'],
                trim: { start: "00:01", end: "00:03" },
                targetExt: ".avi",
                codec: "copy",
                audio: "copy"
            }
        },
        {
            name: "6. MP4 + AV1 + Remove Audio + Crop + Custom Aspect (21:9) + 1080p",
            config: {
                videoPath: path.resolve(TEST_VIDEO),
                outputPath: path.resolve(OUTPUT_DIR, "test6_mp4_av1_remove_crop_21x9_1080p.mp4"),
                actions: ['trim', 'resize', 'codec', 'container'],
                trim: { start: "00:00", end: "00:01" }, // AV1 is very slow
                resize: { logic: "crop", padColor: "black", tw: "1920", th: "822", finalAsp: "21:9" },
                targetExt: ".mp4",
                codec: "libaom-av1",
                audio: "remove",
                quality: "5"
            }
        }
    ];

    let passed = 0;
    for (const test of tests) {
        const success = await runTestCase(test.name, test.config);
        if (success) passed++;
        console.log(pc.dim('-------------------------------------------'));
    }

    console.log(pc.bold(`\n📊 SUMMARY: ${passed}/${tests.length} TESTS PASSED`));
    
    if (passed === tests.length) {
        console.log(pc.green(pc.bold('\n✅ ALL FEATURES STABLE\n')));
    } else {
        console.log(pc.red(pc.bold('\n❌ ENGINE UNSTABLE - FIX REQUIRED\n')));
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});