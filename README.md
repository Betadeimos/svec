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

# SVEC (Simplest Video Editor CLI) ✂️

Stop paying for stupid third-party tools to do simple video edits. SVEC is a completely free, blazing-fast, terminal-based video editor that just works. No ads, no watermarks, no bloatware—just raw FFmpeg power wrapped in a beautiful, keyboard-driven UI.

## ✨ Why SVEC?

- **It's Free and Better**: Stop uploading your videos to sketchy websites or buying overpriced software just to trim a clip. SVEC runs locally, privately, and infinitely faster.
- **Blazing Fast Trimming**: Uses lossless stream copying whenever possible to trim gigabytes of video in seconds.
- **Wizard Interface**: A seamless 5-step process (Files ➔ Trim ➔ Resize ➔ Format ➔ Export).
- **Format & Codec Support**: Convert between H.264, H.265 (HEVC), VP9, AV1, ProRes, and formats like MP4, MKV, WEBM, MOV, AVI.

## 📦 Installation

Navigate to the project folder and run the following command:

```bash
npm install -g . --force
```

**Note:** The `--force` flag guarantees that any old or broken versions of SVEC are completely wiped out and replaced by this clean build.

## 🛠 Usage

Simply open your terminal anywhere and type:

```bash
svec
```

*Select your video, trim it, resize it, format it, and export. It's that simple.*

## ⌨️ Development

1. Clone the repo: `git clone https://github.com/Betadeimos/svec.git`
2. Install dependencies: `npm install`
3. Run locally: `node ui.js`

---
Built with ❤️ for simple, headache-free video editing.