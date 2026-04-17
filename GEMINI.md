# SVEC (Simplest Video Editor CLI) - Project Context

## Project Overview
SVEC is a lightweight, terminal-based video editor designed for quick processing tasks like trimming, resizing, and format conversion. It leverages FFmpeg for high-performance video manipulation while providing a user-friendly CLI experience.

### Key Technologies
- **Runtime:** Node.js
- **CLI Framework:** `@clack/prompts` (Main wizard)
- **TUI Framework:** `ink` & `react` (Advanced UI in `ui.jsx`)
- **Video Processing:** FFmpeg (via `ffmpeg-static` and `ffprobe-static`)
- **Styling:** `picocolors`
- **Transpilation:** Babel (used for React/JSX support in the terminal)

---

## Architecture

### 1. Entry Points
- **`index.js`**: The primary CLI entry point. It uses a state-driven wizard (via `@clack/prompts`) to guide users through selecting a file and configuring editing actions.
- **`run-ui.js` / `ui.jsx`**: An alternative, more visual terminal interface built with Ink. `run-ui.js` handles Babel registration to support JSX in Node.
- **`diag.js`**: A diagnostic script to verify the availability of FFmpeg and FFprobe binaries.

### 2. Core Library (`lib/`)
- **`processor.js`**: contains the `executeFFmpeg` function which builds complex FFmpeg command-line arguments and manages the spawning of the FFmpeg process with progress feedback.
- **`binaries.js`**: Handles the discovery and setup of FFmpeg/FFprobe, checking both system PATH and static binaries.
- **`utils.js`**: Contains helper functions like `parseTime` which supports natural language time inputs (e.g., `1m 20s`, `10.5s`).

### 3. Testing
- **`test_engine.js`**: A comprehensive test suite that creates a synthetic test video and validates various editing operations (trim, resize, codec, audio) using FFprobe for metadata verification.

---

## Development & Usage

### Key Commands
- **Run Main CLI:** `npm start` (or `node index.js`)
- **Run Tests:** `npm test` (or `node test_engine.js`)
- **Run Advanced TUI:** `node run-ui.js` (Requires Babel setup via the script)
- **Check Environment:** `node diag.js`

### Installation Scripts
- **`setup.bat`**: Windows bootstrap script that installs Node.js (via winget if missing) and SVEC globally.
- **`install.bat`**: Local installation script that uses `npm link` to make `svec` available as a global command.

---

## Development Conventions & Technical Notes

### Module System Discrepancy
The project currently has `"type": "module"` set in `package.json`, which implies ES Modules. However:
- **`index.js`** and most files in **`lib/`** use `require` (CommonJS).
- **`ui.jsx`** and **`run-ui.js`** use `import` (ESM).
This indicates a project in transition or one relying on Babel/Node loaders to bridge the gap. When adding new files, clarify the intended module system.

### FFmpeg Integration
SVEC prioritizes **Stream Copying** (`-c:v copy`) whenever possible (e.g., simple trimming without re-encoding) to ensure maximum speed and zero quality loss. Re-encoding is triggered automatically for operations like resizing, codec changes, or precise trimming.

### Time Parsing
The `parseTime` utility is flexible:
- Supports `HH:MM:SS`
- Supports `1h 2m 3s`
- Supports `123s` or just `123` (seconds)

### Future UI
`ui.jsx` represents a more modern, tabbed interface (Files, Trim, Resize, Format, Export) that mirrors the conceptual design found in `v0_reference.txt`.
