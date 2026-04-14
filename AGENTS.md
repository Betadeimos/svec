# SVEC - Simplest Video Editor CLI

## Overview
A terminal-based video editor tailored for handling large video files seamlessly. It offers targeted functionalities rather than being a monolithic tool.

## Core Features
1. **Trim Video**: Clip a video between specified start and end times.
2. **Resize/Reduce Size**: Lower the video file size (by tweaking CRF/bitrate) or resize the pixel resolution.
3. **Codec Conversion**: Convert the video to H.264 (AVC) or H.265 (HEVC).
4. **Combined Actions**: Any combination of the above, running in a single fast FFmpeg pass.
5. **Format Conversion**: Convert between .mp4, .mkv, .mov, .avi, or .gif.

## Known Issues / Potential Improvements
- **Execution Loop Bug**: Fixed (2026-04-14)
- **FFmpeg path**: Fixed (2026-04-14)
- **Audio control**: Fixed (2026-04-14)
- **Input Validation**: Fixed (2026-04-14) - Added validation for aspect ratios, resolutions, extensions, and times.
- **Bitrate control**: Currently uses CRF (Quality 1-10) which is good, but doesn't allow target file size.
- **Error Handling**: Could be improved for cases where FFmpeg fails with specific errors (e.g., out of disk space).

## Technologies Used
- **Node.js**: Underlying platform.
- **@clack/prompts**: For a clean, modern, and beautiful Terminal UI (similar to `pi` and `gemini cli`).
- **FFmpeg**: The core video processing engine (assumed installed and available on the user's system PATH).

## Future Roadmap
- Automatically detect installed FFmpeg or auto-download.
- Add audio extraction/removal options.
- Support more complex filtering without complicating the UI.
