<p align="center">
  <img src="https://raw.githubusercontent.com/Betadeimos/svec/main/logo.png" alt="SVEC Logo" width="200" onerror="this.style.display='none'">
</p>

```text
   _____ __      ________ _____ 
  / ____|\ \    / /  ____/ ____|
 | (___   \ \  / /| |__ | |     
  \___ \   \ \/ / |  __|| |     
  ____) |   \  /  | |___| |____ 
 |_____/     \/   |______\\_____|

   Simplest Video Editor CLI
```

# SVEC (Simplest Video Editor CLI) ✂️

A lightweight, terminal-based video editor built for professionals and enthusiasts who need to process large video files quickly without the bloat of a GUI. SVEC focuses on speed, precision, and zero-headache workflows.

## 🚀 Key Features

- **Blazing Fast Trimming**: Uses stream copying (when possible) to trim GBs of video in seconds.
- **Natural Time Parsing**: Input times naturally like `8.5s`, `1m 20s`, or `1h 2m`. No more tedious `00:00:00.00` formatting.
- **Drag & Drop Support**: Just drag a file into the terminal. SVEC automatically cleans up quotes and handles paths.
- **Auto-Scanning**: Run `svec` in any folder, and it will list all compatible video files for you instantly.
- **Format Conversion**: Convert between **.mp4, .mkv, .mov, .avi**, or even high-speed **Animated .gif**.
- **Codec Transcoding**: Easily toggle between H.264 (AVC) and H.265 (HEVC) for maximum compatibility or compression.
- **Smart File Naming**: SVEC automatically increments filenames (e.g., `video_edited_1.mp4`) so you never overwrite work.
- **Flexible Audio Control**: Choose to keep the original audio stream, convert to compatible AAC, or strip it entirely for a silent video.
- **Infinite Session**: Edit multiple videos or perform multiple tasks in one go without restarting the app.

## 📦 Installation

Ensure you have [Node.js](https://nodejs.org/) installed, then run:

```bash
npm install -g Betadeimos/svec
```

*(Windows users on restricted environments: use `npm.cmd install -g Betadeimos/svec`)*.

## 🛠 Usage

Simply open your terminal in any folder containing videos and type:

```bash
svec
```

## ⌨️ Development

To contribute or modify your local version:

1. Clone the repo: `git clone https://github.com/Betadeimos/svec.git`
2. Install dependencies: `npm install`
3. Run locally: `node index.js`

---
Built with ❤️ for simple, headache-free video editing.
