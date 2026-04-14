# SVEC (Simplest Video Editor CLI) ✂️

A lightweight, terminal-based video editor built for professionals and enthusiasts who need to process large video files quickly without the bloat of a GUI.

## 🚀 Features

- **Blazing Fast Trimming**: Uses stream copying when possible to trim GBs of video in seconds.
- **Smart Time Parsing**: Input times naturally like `8.5s`, `1m 20s`, or `1h 2m`. No more tedious `00:00:00` formatting.
- **Auto-Scanning**: Run `svec` in any folder, and it will automatically list all compatible video files for you to pick from.
- **Transcoding Made Easy**: Convert between H.264 (AVC) and H.265 (HEVC) with a single click.
- **Smart File Naming**: Never overwrite your work. SVEC automatically increments filenames (e.g., `video_trim_1.mp4`).
- **Universal Audio**: Automatically fixes incompatible audio codecs (like `ipcm`) to standard `AAC` so your videos play everywhere.
- **Global Access**: Install it once and run it anywhere on your system.

## 📦 Installation

Ensure you have [Node.js](https://nodejs.org/) installed, then run:

```bash
npm install -g Betadeimos/svec
```

*(Windows users on restricted environments may need to use `npm.cmd` instead).*

## 🛠 Usage

Simply open your terminal in any folder containing videos and type:

```bash
svec
```

## ⌨️ Development

To contribute or modify your local version:

1. Clone the repo: `git clone https://github.com/Betadeimos/svec.git`
2. Install dependencies: `npm install`
3. Link locally: `npm link` (or use `node index.js`)

---
Built with ❤️ for simple, headache-free video editing.
