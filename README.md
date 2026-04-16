<p align="center">
  <img src="https://raw.githubusercontent.com/Betadeimos/svec/main/logo.png" alt="SVEC Logo" width="200" onerror="this.style.display='none'">
</p>

```text
  ┌───────────────────────────────────────┐
  │                                       │
  │   ███████╗██╗   ██╗███████╗ ██████╗   │
  │   ██╔════╝██║   ██║██╔════╝██╔════╝   │
  │   ███████╗██║   ██║█████╗  ██║        │
  │   ╚════██║╚██╗ ██╔╝██╔══╝  ██║        │
  │   ███████║ ╚████╔╝ ███████╗╚██████╗   │
  │   ╚══════╝  ╚═══╝  ╚══════╝ ╚═════╝   │
  │                                       │
  └───────────────────────────────────────┘
```

# SVEC (Simplest Video Editor CLI) v1.0.9 ✂️

A lightweight, terminal-based video editor built for professionals and enthusiasts who need to process large video files quickly without the bloat of a GUI. SVEC focuses on speed, precision, and zero-headache workflows.

## 🚀 Key Features

- **Blazing Fast Trimming**: Uses stream copying (when possible) to trim GBs of video in seconds.
- **Natural Time Parsing**: Input times naturally like `1m 20s`, `8.5s`, or `1h`. No more tedious `00:00:00.00` formatting.
- **Smarter Resizing**: Choose from aspect ratio templates (16:9, 9:16, 1:1, 4:3) and SVEC smartly calculates resolutions. Choose between Fit, Fill (Crop), or Stretch.
- **Advanced Audio Control**: Dedicated step to select between Original Copy, AAC conversion, or complete removal.
- **Bootstrap Setup**: New `setup.bat` file allows users without Node.js to install everything automatically via winget.
- **Drag & Drop Support**: Just drag a file into the terminal. SVEC automatically cleans up quotes and handles paths.
- **Codec & Format Conversion**: Convert between H.264/H.265 and formats like .mp4, .mkv, .mov, or .gif.
- **State-Driven Navigation**: Hit `Esc` to go back to the previous step or `Ctrl+Q` to quit anytime.
- **Smart File Naming**: SVEC automatically increments filenames (e.g., `video_trim_1.mp4`) so you never overwrite work.
- **Quality 1-10 Scale**: Simplified quality selection (defaults to 5 - Balanced) with real-time file size estimations.

## 📦 Installation

### Windows (Recommended)
If you don't have Node.js installed, download and run `setup.bat` from this repository. It will automatically install Node.js and SVEC for you.

### Manual
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

1. Clone the repo: `git clone https://github.com/Betadeimos/svec.git`
2. Install dependencies: `npm install`
3. Run locally: `node index.js`

---
Built with ❤️ for simple, headache-free video editing.
