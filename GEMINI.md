# SVEC (Simplest Video Editor CLI) - Project Context

## Project Overview
SVEC is a lightweight, terminal-based video editor designed for quick processing tasks like trimming, resizing, and format conversion. It leverages FFmpeg for high-performance video manipulation while providing a user-friendly CLI experience.

### Key Technologies
- **Runtime:** Node.js (Native ESM)
- **CLI Framework:** `@clack/prompts` (Main TUI Wizard)
- **TUI Entry Point:** `ui.js` (Unified interface)
- **Video Processing:** FFmpeg (via `ffmpeg-static` and `ffprobe-static`)
- **Styling:** `picocolors`

---

## Architecture

### 1. Entry Points
- **`index.js`**: The primary CLI entry point. It orchestrates the TUI flow using `@clack/prompts`.
- **`ui.js`**: The main unified TUI entry point, leveraging native ESM for a modern, responsive terminal experience.

### 2. Core Library (`lib/`)
- **`processor.js`**: Contains the `executeFFmpeg` function which builds complex FFmpeg command-line arguments and manages the spawning of the FFmpeg process with progress feedback.
- **`binaries.js`**: Handles the discovery and setup of FFmpeg/FFprobe, checking both system PATH and static binaries.
- **`utils.js`**: Contains helper functions like `parseTime` which supports natural language time inputs (e.g., `1m 20s`, `10.5s`).

### 3. Testing
- **`test_engine.js`**: A comprehensive test suite that creates a synthetic test video and validates various editing operations (trim, resize, codec, audio) using FFprobe for metadata verification.

---

## Development & Usage

### Key Commands
- **Run Main CLI:** `npm start` (or `node index.js`)
- **Run Tests:** `npm test` (or `node test_engine.js`)
- **Run TUI:** `node ui.js`

### Installation Scripts
- **`setup.bat`**: Windows bootstrap script that installs Node.js (via winget if missing) and SVEC globally.
- **`install.bat`**: Local installation script that uses `npm link` to make `svec` available as a global command.

---

## Development Conventions & Technical Notes

### Module System
The project is built using native ES Modules (`"type": "module"` in `package.json`). All new components should adhere to ESM standards.

### FFmpeg Integration
SVEC prioritizes **Stream Copying** (`-c:v copy`) whenever possible (e.g., simple trimming without re-encoding) to ensure maximum speed and zero quality loss. Re-encoding is triggered automatically for operations like resizing, codec changes, or precise trimming.

### Time Parsing
The `parseTime` utility is flexible:
- Supports `HH:MM:SS`
- Supports `1h 2m 3s`
- Supports `123s` or just `123` (seconds)
