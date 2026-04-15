# SVEC - Simplest Video Editor CLI (v1.0.6)

## ⚠️ SACRED RULES (Read before every execution)
1. **SPEED TRUMPS EVERYTHING**: Every feature must be optimized for maximum speed and minimum overhead. 
2. **KEEP IT LIGHT**: No unnecessary dependencies, no heavy processing, no bloat.
3. **SINGLE-PASS PHILOSOPHY**: Keep FFmpeg operations to a single pass whenever possible to maintain lossless quality and save time.
4. **CHALLENGE BLOAT**: If a request would make SVEC slow, sluggish, or heavy, CHALLENGE the idea.
5. **LOOP PROTECTION**: If a bash command fails or gets stuck, STOP immediately and ask the user to run it.
6. **VERSIONING**: Increase the version number in package.json, index.js, and docs before every push.

## Overview
A terminal-based video editor tailored for handling large video files seamlessly. It offers targeted functionalities rather than being a monolithic tool, prioritizing speed, lossless quality where possible, and a professional-grade TUI experience.

## Core Features
1. **Trim Video**: High-speed clipping between specified start and end times using stream copying or precise re-encoding.
2. **Smarter Resize**: Change resolution using aspect ratio templates (16:9, 9:16, 1:1, etc.) with smart logic for **Fit (Padding)**, **Fill (Crop)**, or **Stretch**.
3. **Audio Control**: Dedicated control to **Keep Original** (Stream Copy), **Convert to AAC** (Universal compatibility), or **Remove Audio** entirely.
4. **Codec Conversion**: Toggle between **H.264 (AVC)** for compatibility or **H.265 (HEVC)** for maximum compression.
5. **Format Conversion**: Instant container switching between **.mp4, .mkv, .mov, .avi**, or high-performance **Animated .gif**.
6. **Single-Pass Engine**: All combined actions run in a single optimized FFmpeg pass to prevent quality loss and save time.

## Key UX Features
- **State-Driven Navigation**: Robust menu system allowing `Esc` to go back one step and `Ctrl+Q` to quit at any time.
- **Dynamic Metadata**: Real-time resolution, aspect ratio, and duration display upon file selection.
- **Natural Time Input**: Input times naturally like `1m 20s`, `8.5s`, or `1h`.
- **Quality 1-10 Scale**: Simplified quality selection with real-time rough file size estimations.
- **Drag & Drop**: Intelligent Windows path cleanup (automatic quote removal).
- **Bootstrap Setup**: `setup.bat` handles Node.js and SVEC installation automatically via Windows `winget`.

## Technologies Used
- **Node.js**: Underlying platform.
- **@clack/prompts**: For the modern, beautiful Terminal UI.
- **FFmpeg & FFprobe**: The core processing engines (bundled via static binaries or used from system PATH).

## Release History
- **v1.0.6**: Formalized Core Development Principles and versioning rules.
- **v1.0.5**: Bootstrap setup (`setup.bat`), Audio control, Aspect ratio templates, and State-driven navigation fixed.
- **v1.0.0**: Initial Release.
