# SVEC — Agent Instructions (v1.1.1)

## ⚠️ READ THIS FIRST, EVERY TIME

### Project Location & Path Rules
You are already executing inside the project root directory. 

- **ONLY USE RELATIVE PATHS** for all file operations (e.g., `read index.js`, `edit package.json`).
- **NEVER use absolute paths.** (Absolute paths contain complex token combinations that cause system instability).
- NEVER use `../` navigation or attempt to leave the current directory.
- If a file read fails, STOP immediately and tell the user. Do not blindly retry or mutate the filename.

### File Map
- `index.js`        — entry point, orchestrates the TUI flow
- `lib/binaries.js`  — FFmpeg/FFprobe path resolution and metadata
- `lib/processor.js` — FFmpeg argument construction and execution
- `lib/utils.js`     — shared helper functions (time parsing, etc.)
- `package.json`    — version number and dependencies
- `AGENTS.md`       — this file
- `setup.bat`       — Windows bootstrap installer

**There are no other source files. Do not invent filenames. Rely ONLY on the File Map above.**

---

## Sacred Rules

1. **SPEED TRUMPS EVERYTHING** — every feature must be optimised for speed and minimum overhead.
2. **NO BLOAT** — no unnecessary dependencies, no heavy processing; if a request makes SVEC slow or heavy, challenge it.
3. **SINGLE-PASS FFMPEG** — all operations must run in a single FFmpeg pass to preserve quality and save time.
4. **DEFAULT TO LOSSLESS** — if not specified, video ops must not re-encode; a trim must never re-encode unless the user explicitly chooses Precise mode.
5. **LOOP PROTECTION** — if a bash command fails or gets stuck, STOP immediately and ask the user to run it manually; never retry blindly.
6. **VERSIONING** — bump version in `package.json` before every push.
7. **TEST BEFORE COMMIT** — run `npm test` before every backend change; if tests fail, fix first; if test file is missing, create it.
8. **DOC SYNC** — update AGENTS.md and README.md with every functional change.

---

## What This App Does
Terminal video editor (TUI) for Windows. Modular architecture. Wraps FFmpeg with a 
guided step-by-step menu for: trim, resize, codec conversion, format conversion, 
audio control. All operations combined into one FFmpeg pass.

## Stack
- Node.js + `@clack/prompts` (TUI)
- FFmpeg + FFprobe (bundled static binaries or system PATH)

## Key Logic to Never Break
- `parseTime()` — working correctly, do not refactor.
- FFmpeg arg construction in the `execute` step — proven logic, wrap don't rewrite.
- The `state` step machine — fragile, edit carefully.

## Release History
- v1.1.1: Fixed Shift+Tab not navigating back in TUI menus
- v1.1.0: Added quality selection with size estimates for re-encoding
- v1.0.9: Refactored into modular lib/ structure, pruned unused files
- v1.0.8: Updated agent path rules to enforce relative paths and prevent hallucination loops
- v1.0.7: Polished UX, improved error handling, lossless-by-default enforcement
- v1.0.6: Formalised core development principles and versioning rules
- v1.0.5: Bootstrap setup, audio control, aspect ratio templates, state-driven navigation
- v1.0.0: Initial release
