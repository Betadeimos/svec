#!/usr/bin/env node
import { render, Box, Text, useInput, useApp } from 'ink';
import React, { useState, useEffect } from 'react';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getFFmpegPath, setupFFmpeg, getMetadata } from './lib/binaries.js';
import { parseTime } from './lib/utils.js';

const getClipboard = () => {
  try {
    if (process.platform === 'win32') {
      return execSync('powershell.exe -NoProfile -Command Get-Clipboard').toString().trim();
    }
    return "";
  } catch (e) { return ""; }
};

const cleanPath = (p) => {
    if (!p) return "";
    // Remove control characters, quotes, and whitespace from start/end
    return p.replace(/[\x00-\x1F\x7F]/g, "").replace(/[\"']/g, "").trim();
};

const SVEC_LOGO = `███████╗██╗   ██╗███████╗ ██████╗
██╔════╝██║   ██║██╔════╝██╔════╝
███████╗██║   ██║█████╗  ██║     
╚════██║╚██╗ ██╔╝██╔══╝  ██║     
███████║ ╚████╔╝ ███████╗╚██████╗
╚══════╝  ╚═══╝  ╚══════╝ ╚═════╝`;

const TABS = ['Files', 'Trim', 'Resize', 'Format', 'Export'];

const FORMAT_OPTIONS = ['Keep original', '.mp4', '.mov', '.webm', '.mkv', '.avi', '.gif'];
const CODEC_OPTIONS = ['Keep original', 'libx264', 'libx265', 'prores', 'libvpx-vp9', 'libaom-av1'];
const AUDIO_OPTIONS = ['Keep original', 'aac', 'remove'];
const SCALE_OPTIONS = ['fit', 'crop', 'stretch'];
const ASPECT_OPTIONS = ['Original', '16:9', '9:16', '1:1', '4:3', 'Custom'];
const RES_OPTIONS = ['Original', '720p', '1080p', '4K', 'Custom'];

const isMissingFileError = (err) => {
    if (!err) return false;
    const str = String(err).toLowerCase();
    return str.includes('no such file') || str.includes('enoent') || str.includes('4058');
};

const friendlyError = "Error: The selected video file does not exist. Please return to the Files tab and select a valid file.";

/**
 * Master headless bridge function to handle the final FFmpeg execution.
 */
const handleFinalExecution = (
  trimStart, trimEnd, 
  selAspectIdx, selScaleIdx, selResIdx, 
  customAspectW, customAspectH, customResW, customResH, 
  selFormatIdx, selCodecIdx, selAudioIdx, selQualityIdx, 
  fileName, outputIndex, customPathInput,
  onProgress, onComplete, onError
) => {
  return new Promise((resolve) => {
    try {
      const ffmpegPath = getFFmpegPath();
      const inputPath = path.resolve(fileName);
      
      const targetExt = selFormatIdx === 0 ? path.extname(fileName) : FORMAT_OPTIONS[selFormatIdx];
      const videoCodec = selCodecIdx === 0 ? 'copy' : CODEC_OPTIONS[selCodecIdx];
      const audioChoice = selAudioIdx === 0 ? 'copy' : AUDIO_OPTIONS[selAudioIdx];
      
      let tw = 1920, th = 1080;
      if (selResIdx === 1) { tw = 1280; th = 720; }
      else if (selResIdx === 2) { tw = 1920; th = 1080; }
      else if (selResIdx === 3) { tw = 3840; th = 2160; }
      else if (selResIdx === 4) { tw = parseInt(customResW) || 1920; th = parseInt(customResH) || 1080; }

      const finalAsp = selAspectIdx === 0 ? 'skip' : ASPECT_OPTIONS[selAspectIdx];

      const config = {
          videoPath: inputPath,
          trim: { start: trimStart, end: trimEnd },
          resize: (selAspectIdx !== 0 || selResIdx !== 0) ? {
              logic: SCALE_OPTIONS[selScaleIdx],
              tw, th, finalAsp
          } : null,
          codec: videoCodec,
          audio: audioChoice,
          quality: (selQualityIdx + 1).toString(),
          targetExt,
          actions: ['trim', 'resize', 'codec', 'container']
      };

      let inputArgs = [], outputArgs = [], videoFilters = [];
      inputArgs.push('-ss', parseTime(trimStart));
      if (trimEnd && trimEnd !== "00:00") inputArgs.push('-to', parseTime(trimEnd));
      
      if (config.resize) {
          const { logic, tw, th } = config.resize;
          if (logic === 'stretch') videoFilters.push(`scale=${tw}:${th},setsar=1:1`);
          else if (logic === 'fit') videoFilters.push(`scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:black,setsar=1:1`);
          else if (logic === 'crop') videoFilters.push(`scale=${tw}:${th}:force_original_aspect_ratio=increase,crop=${tw}:${th},setsar=1:1`);
      }

      let needsReEncode = false;
      if (targetExt === '.gif') {
          needsReEncode = true;
          const gifMap = { '1': [5, 320], '2': [8, 360], '3': [10, 380], '4': [12, 420], '5': [15, 480], '6': [18, 540], '7': [20, 600], '8': [22, 640], '9': [25, 680], '10': [30, 720] };
          const [gfps, gscale] = gifMap[config.quality || '5'];
          videoFilters.push(`fps=${gfps},scale=${gscale}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`);
          outputArgs.push('-c:v', 'gif');
      } else {
          needsReEncode = config.resize || config.codec !== 'copy';
          if (needsReEncode) {
              const crfMap = { '1': 45, '2': 40, '3': 35, '4': 30, '5': 26, '6': 23, '7': 20, '8': 18, '9': 14, '10': 10 };
              outputArgs.push('-c:v', config.codec === 'copy' ? 'libx264' : config.codec, '-crf', crfMap[config.quality] || '26');
          } else {
              outputArgs.push('-c:v', 'copy');
          }
      }

      if (videoFilters.length > 0) outputArgs.push('-vf', videoFilters.join(','));
      if (config.audio === 'remove' || targetExt === '.gif') outputArgs.push('-an');
      else if (config.audio === 'copy') outputArgs.push('-c:a', 'copy');
      else {
          const audioCodec = targetExt === '.webm' ? 'libopus' : 'aac';
          outputArgs.push('-c:a', audioCodec);
      }

      const parsed = path.parse(inputPath);
      const outDir = outputIndex === 0 ? parsed.dir || '.' : cleanPath(customPathInput);
      let outputPath = path.join(outDir, `${parsed.name}_edited${targetExt}`);
      let c = 1; while (fs.existsSync(outputPath)) { outputPath = path.join(outDir, `${parsed.name}_edited_${c++}${targetExt}`); }

      const ffmpegArgs = ['-y', ...inputArgs, '-i', inputPath, ...outputArgs, outputPath];

      const toSecondsLocal = (t) => {
          const s = parseTime(t);
          if (!s.includes(':')) return parseFloat(s);
          const p = s.split(':').map(Number).reverse();
          return (p[0]||0) + (p[1]||0)*60 + (p[2]||0)*3600;
      };

      const startS = toSecondsLocal(trimStart);
      const endS = (trimEnd && trimEnd !== "00:00") ? toSecondsLocal(trimEnd) : startS + 1;
      const totalDuration = Math.max(1, endS - startS);

      const child = spawn(ffmpegPath, ffmpegArgs);      let errorLog = '';
      
      child.stderr.on('data', (data) => {
          const str = data.toString();
          errorLog += str;
          const match = str.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
          if (match) {
              const currentTime = toSecondsLocal(match[1]);
              const relativeTime = currentTime - (needsReEncode ? 0 : startS); 
              const pct = Math.min(100, Math.max(0, (relativeTime / totalDuration) * 100));
              onProgress(pct);
          }
      });

      child.on('close', (code) => {
          if (code === 0) onComplete(outputPath);
          else {
              let msg = `FFmpeg failed (code ${code}): ${errorLog.split('\n').pop()}`;
              if (isMissingFileError(errorLog)) msg = friendlyError;
              onError(msg);
          }
          resolve(); 
      });

      child.on('error', (err) => {
          let msg = err.message;
          if (isMissingFileError(err.code) || isMissingFileError(err.message)) msg = friendlyError;
          onError(msg);
          resolve(); 
      });

    } catch (err) {
      let msg = err.message;
      if (isMissingFileError(err.code) || isMissingFileError(err.message)) msg = friendlyError;
      onError(msg);
      resolve(); 
    }
  });
};

const outputOptions = ["Same as input", "Custom path..."];
const PRIMARY_COLOR = '#00DFFF';

const App = () => {
  const { exit } = useApp();
  const [activeTab, setActiveTab] = useState(0);
  const [activeFileIdx, setActiveFileIdx] = useState(0); 
  const [videoFiles, setVideoFiles] = useState([]); 
  const [chosenFileName, setChosenFileName] = useState(""); 
  const [activeField, setActiveField] = useState(1); 
  
  const [query, setQuery] = useState("");               
  const [customPath, setCustomPath] = useState("");     
  
  const [trimStart, setTrimStart] = useState("00:00");
  const [trimEnd, setTrimEnd] = useState("00:00");
  const [outputPathIndex, setOutputPathIndex] = useState(0);
  
  // Resize State
  const [resizeAspectIdx, setResizeAspectIdx] = useState(0);
  const [resizeScaleIdx, setResizeScaleIdx] = useState(0);
  const [resizeResIdx, setResizeResIdx] = useState(0);
  
  const [selAspectIdx, setSelAspectIdx] = useState(0);
  const [selScaleIdx, setSelScaleIdx] = useState(0);
  const [selResIdx, setSelResIdx] = useState(0);
  
  const [resizeCustomAspectW, setResizeCustomAspectW] = useState("16");
  const [resizeCustomAspectH, setResizeCustomAspectH] = useState("9");
  const [resizeCustomResW, setResizeCustomResW] = useState("1920");
  const [resizeCustomResH, setResizeCustomResH] = useState("1080");
  const [resizePanel, setResizePanel] = useState(0);
  const [resizeFocus, setResizeFocus] = useState('list');
  
  // Format State
  const [formatIdx, setFormatIdx] = useState(0);
  const [codecIdx, setCodecIdx] = useState(0);
  const [audioIdx, setAudioIdx] = useState(0);
  const [qualityIdx, setQualityIdx] = useState(4); 
  
  const [selFormatIdx, setSelFormatIdx] = useState(0);
  const [selCodecIdx, setSelCodecIdx] = useState(0);
  const [selAudioIdx, setSelAudioIdx] = useState(0);
  const [selQualityIdx, setSelQualityIdx] = useState(4);
  
  const [formatPanel, setFormatPanel] = useState(0);
  
  // Export State
  const [exportPhase, setExportPhase] = useState('ready'); 
  const [exportProgress, setExportProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: (process.stdout.rows || 24) - 1,
  });

  const loadFiles = async () => {
      try {
          const cwd = process.cwd();
          const files = fs.readdirSync(cwd);
          const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
          
          const filtered = files.filter(f => videoExtensions.includes(path.extname(f).toLowerCase()));
          const results = filtered.map(name => {
              const stats = fs.statSync(path.join(cwd, name));
              const meta = getMetadata(path.join(cwd, name)) || {};
              const formatSize = (bytes) => {
                  if (bytes === 0) return '0 B';
                  const k = 1024;
                  const sizes = ['B', 'KB', 'MB', 'GB'];
                  const i = Math.floor(Math.log(bytes) / Math.log(k));
                  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
              };
              
              const formatDuration = (sec) => {
                  if (!sec) return "00:00";
                  const m = Math.floor(sec / 60);
                  const s = Math.floor(sec % 60);
                  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
              };

              return {
                  name,
                  size: formatSize(stats.size),
                  duration: formatDuration(meta.duration),
                  resolution: meta.width ? `${meta.width}x${meta.height}` : "Unknown",
                  ratio: meta.aspect || "16:9"
              };
          });
          
          setVideoFiles(results);
          if (results.length > 0 && !chosenFileName) {
              setChosenFileName(results[0].name);
          }
      } catch (e) {}
  };

  useEffect(() => {
    const onResize = () => setSize({ columns: process.stdout.columns, rows: process.stdout.rows - 1 });
    process.stdout.on('resize', onResize);
    return () => process.stdout.off('resize', onResize);
  }, []);

  useEffect(() => {
      const init = async () => {
          await setupFFmpeg().catch(() => {});
          await loadFiles();
      };
      init();
  }, []);

  useEffect(() => {
      if (activeTab === 0) loadFiles();
  }, [activeTab]);

  const filteredFiles = videoFiles.filter(f => f.name.toLowerCase().includes(query.toLowerCase()));
  const currentFile = videoFiles.find(f => f.name === chosenFileName) || videoFiles[0] || { name: "No video found", size: "-", duration: "00:00", resolution: "-", ratio: "16:9" };

  useEffect(() => {
    if (currentFile && currentFile.name !== "No video found") {
        setTrimStart("00:00");
        setTrimEnd(currentFile.duration);
    }
  }, [currentFile.name, currentFile.duration]);

  const toSec = (t) => {
    if (!t) return 0;
    const parts = t.split(':').map(Number).reverse();
    let sec = 0;
    if (parts[0]) sec += parts[0];
    if (parts[1]) sec += parts[1] * 60;
    if (parts[2]) sec += parts[2] * 3600;
    return sec;
  };

  useInput((input, key) => {
    if (key.escape) return exit();

    if (activeField === -1) {
      if (key.rightArrow) setActiveTab(prev => (prev === TABS.length - 1 ? 0 : prev + 1));
      if (key.leftArrow) setActiveTab(prev => (prev === 0 ? TABS.length - 1 : prev - 1));
      if (key.downArrow || key.return) setActiveField(0); 
      return;
    }

    if (activeTab === 0) {
      if (activeField === 0) { // Search
        if (key.upArrow) setActiveField(-1);
        if (key.downArrow) setActiveField(1);
        if (key.return) {
           if (filteredFiles.length > 0) {
               setChosenFileName(filteredFiles[activeFileIdx % filteredFiles.length].name);
               if (size.rows >= 20 && size.columns >= 50) setActiveField(2);
               else { setActiveTab(1); setActiveField(0); }
           } else setActiveField(1);
           return;
        }
        if (key.backspace) { setQuery(prev => prev.slice(0, -1)); setActiveFileIdx(0); }
        else if (input && !key.ctrl && !key.meta && input.length === 1 && !key.return) { 
            setQuery(prev => prev + input); 
            setActiveFileIdx(0);
        }
      }
      else if (activeField === 1) { // List
        if (key.upArrow) {
          if (activeFileIdx > 0) setActiveFileIdx(prev => prev - 1);
          else setActiveField(0);
        }
        if (key.downArrow) {
          if (activeFileIdx < filteredFiles.length - 1) setActiveFileIdx(prev => prev + 1);
          else if (size.rows >= 20 && size.columns >= 50) setActiveField(2);
        }
        if (key.return) {
          if (filteredFiles[activeFileIdx]) setChosenFileName(filteredFiles[activeFileIdx].name);
          if (size.rows >= 20 && size.columns >= 50) setActiveField(2);
          else { setActiveTab(1); setActiveField(0); }
        }
      }
      else if (activeField === 2) { // Output
        if (key.upArrow) setActiveField(1);
        if (key.leftArrow || key.rightArrow) setOutputPathIndex(prev => (prev === 0 ? 1 : 0));
        
        if (outputPathIndex === 1) {
            if (key.ctrl && input === 'v') {
                const pasted = getClipboard();
                setCustomPath(prev => prev + cleanPath(pasted));
            }
            else if (key.backspace) setCustomPath(prev => prev.slice(0, -1));
            else if (input && !key.ctrl && !key.meta) {
                setCustomPath(prev => prev + input);
            }
        }
        if (key.return) { setActiveTab(1); setActiveField(0); }
      }
    }

    else if (activeTab === 1) { // Trim
      if (activeField === 0 || activeField === 1) {
        if (key.upArrow) {
          if (activeField === 1) setActiveField(0);
          else setActiveField(-1);
        }
        if (key.downArrow && activeField === 0) setActiveField(1);
        
        const formatT = (s) => `${String(Math.floor(s/60)).padStart(2, '0')}:${String(s%60).padStart(2, '0')}`;
        
        if (key.backspace) {
          if (activeField === 0) setTrimStart(prev => prev.length > 1 ? prev.slice(0, -1) : "");
          else setTrimEnd(prev => prev.length > 1 ? prev.slice(0, -1) : "");
        } else if (input && !key.ctrl && !key.meta && /^[\d:]$/.test(input)) {
          const isFormatted = (str) => /^\d{2}:\d{2}$/.test(str);
          if (activeField === 0) setTrimStart(prev => (isFormatted(prev) ? input : prev + input));
          else setTrimEnd(prev => (isFormatted(prev) ? input : prev + input));
        } else {
          const delta = key.leftArrow ? -1 : (key.rightArrow ? 1 : 0);
          if (delta !== 0) {
            const totalS = toSec(currentFile.duration);
            if (activeField === 0) {
              const newS = Math.max(0, Math.min(toSec(trimStart) + delta, toSec(trimEnd) - 1));
              setTrimStart(formatT(newS));
            } else {
              const newE = Math.max(toSec(trimStart) + 1, Math.min(toSec(trimEnd) + delta, totalS));
              setTrimEnd(formatT(newE));
            }
          }
        }
        if (key.return) {
          if (activeField === 0) {
             setTrimStart(formatT(toSec(trimStart)));
             setActiveField(1);
          }
          else { 
             setTrimEnd(formatT(toSec(trimEnd)));
             setActiveTab(2); setActiveField(0); 
          }
        }
      }
    }
    else if (activeTab === 2) { // Resize
      if (activeField === 0) {
        const hasScaleMode = selAspectIdx !== 0; 
        const getPanels = () => {
          const p = [0];
          if (hasScaleMode) p.push(1);
          p.push(2);
          return p;
        };
        const panels = getPanels();

        if (key.upArrow || key.downArrow) {
          const delta = key.upArrow ? -1 : 1;
          if (resizeFocus === 'list') {
            if (resizePanel === 0) {
               if (key.upArrow && resizeAspectIdx === 0) setActiveField(-1);
               else setResizeAspectIdx(Math.max(0, Math.min(5, resizeAspectIdx + delta)));
            } else if (resizePanel === 1) {
               if (key.upArrow && resizeScaleIdx === 0) setActiveField(-1);
               else setResizeScaleIdx(Math.max(0, Math.min(2, resizeScaleIdx + delta)));
            } else if (resizePanel === 2) {
               if (key.upArrow && resizeResIdx === 0) setActiveField(-1);
               else setResizeResIdx(Math.max(0, Math.min(4, resizeResIdx + delta)));
            }
          } else {
             if (key.upArrow) setResizeFocus('list');
          }
        }
        else if (key.leftArrow || key.rightArrow) {
          if (resizeFocus === 'list') {
             const currentIdx = panels.indexOf(resizePanel);
             const nextIdx = Math.max(0, Math.min(panels.length - 1, currentIdx + (key.leftArrow ? -1 : 1)));
             setResizePanel(panels[nextIdx]);
          } else {
             if (key.leftArrow) {
                 if (resizeFocus === 'customH') setResizeFocus('customW');
                 else {
                     setResizeFocus('list');
                     const currentIdx = panels.indexOf(resizePanel);
                     if (currentIdx > 0) setResizePanel(panels[currentIdx - 1]);
                 }
             } else {
                 if (resizeFocus === 'customW') setResizeFocus('customH');
                 else {
                     setResizeFocus('list');
                     const currentIdx = panels.indexOf(resizePanel);
                     if (currentIdx < panels.length - 1) setResizePanel(panels[currentIdx + 1]);
                 }
             }
          }
        }
        else if (key.backspace) {
          if (resizeFocus === 'customW') {
             if (resizePanel === 0) setResizeCustomAspectW(p => p.slice(0, -1));
             else if (resizePanel === 2) setResizeCustomResW(p => p.slice(0, -1));
          } else if (resizeFocus === 'customH') {
             if (resizePanel === 0) setResizeCustomAspectH(p => p.slice(0, -1));
             else if (resizePanel === 2) setResizeCustomResH(p => p.slice(0, -1));
          }
        }
        else if (input && !key.ctrl && !key.meta && /^\d$/.test(input)) {
          if (resizeFocus === 'customW') {
             if (resizePanel === 0) setResizeCustomAspectW(p => p + input);
             else if (resizePanel === 2) setResizeCustomResW(p => p + input);
          } else if (resizeFocus === 'customH') {
             if (resizePanel === 0) setResizeCustomAspectH(p => p + input);
             else if (resizePanel === 2) setResizeCustomResH(p => p + input);
          }
        }
        else if (key.return) {
          if (resizeFocus === 'list') {
            if (resizePanel === 0) {
               setSelAspectIdx(resizeAspectIdx);
               if (resizeAspectIdx === 5) setResizeFocus('customW');
               else {
                   const newHasScaleMode = resizeAspectIdx !== 0;
                   const newPanels = [0];
                   if (newHasScaleMode) newPanels.push(1);
                   newPanels.push(2);
                   const pnlIdx = newPanels.indexOf(0);
                   if (pnlIdx < newPanels.length - 1) setResizePanel(newPanels[pnlIdx + 1]);
                   else { setActiveTab(3); setActiveField(0); }
               }
            } else if (resizePanel === 1) {
               setSelScaleIdx(resizeScaleIdx);
               const pnlIdx = panels.indexOf(1);
               if (pnlIdx < panels.length - 1) setResizePanel(panels[pnlIdx + 1]);
               else { setActiveTab(3); setActiveField(0); }
            } else if (resizePanel === 2) {
               setSelResIdx(resizeResIdx);
               if (resizeResIdx === 4) setResizeFocus('customW');
               else {
                   const pnlIdx = panels.indexOf(2);
                   if (pnlIdx < panels.length - 1) setResizePanel(panels[pnlIdx + 1]);
                   else { setActiveTab(3); setActiveField(0); }
               }
            }
          } else {
             if (resizeFocus === 'customW') {
                setResizeFocus('customH');
             } else {
                setResizeFocus('list');
                const newPanels = [0];
                if (resizePanel === 0) {
                    if (resizeAspectIdx !== 0) newPanels.push(1);
                    newPanels.push(2);
                } else newPanels.push(...panels.slice(1));
                const pnlIdx = newPanels.indexOf(resizePanel);
                if (pnlIdx !== -1 && pnlIdx < newPanels.length - 1) setResizePanel(newPanels[pnlIdx + 1]);
                else { setActiveTab(3); setActiveField(0); }
             }
          }
        }
      }
    }
    else if (activeTab === 3) { // Format
      if (activeField === 0) {
        const panels = [0, 1, 2, 3];
        if (key.upArrow || key.downArrow) {
          const delta = key.upArrow ? -1 : 1;
          if (formatPanel === 0) {
             if (key.upArrow && formatIdx === 0) setActiveField(-1);
             else setFormatIdx(Math.max(0, Math.min(FORMAT_OPTIONS.length - 1, formatIdx + delta)));
          } else if (formatPanel === 1) {
             if (key.upArrow && codecIdx === 0) setActiveField(-1);
             else setCodecIdx(Math.max(0, Math.min(CODEC_OPTIONS.length - 1, codecIdx + delta)));
          } else if (formatPanel === 2) {
             if (key.upArrow && audioIdx === 0) setActiveField(-1);
             else setAudioIdx(Math.max(0, Math.min(AUDIO_OPTIONS.length - 1, audioIdx + delta)));
          } else if (formatPanel === 3) {
             if (key.upArrow) setFormatPanel(2);
          }
        }
        else if (key.leftArrow || key.rightArrow) {
           if (formatPanel === 3 && (key.leftArrow || key.rightArrow)) {
              if (key.leftArrow) setQualityIdx(Math.max(0, qualityIdx - 1));
              else setQualityIdx(Math.min(9, qualityIdx + 1));
           } else {
              const currentIdx = panels.indexOf(formatPanel);
              const nextIdx = Math.max(0, Math.min(panels.length - 1, currentIdx + (key.leftArrow ? -1 : 1)));
              setFormatPanel(panels[nextIdx]);
           }
        }
        else if (input && !key.ctrl && !key.meta && /^\d$/.test(input) && formatPanel === 3) {
            const num = Number(input);
            if (num === 0) setQualityIdx(9);
            else setQualityIdx(num - 1);
        }
        else if (key.return) {
          if (formatPanel === 0) {
             setSelFormatIdx(formatIdx);
             setFormatPanel(1);
          } else if (formatPanel === 1) {
             setSelCodecIdx(codecIdx);
             setFormatPanel(2);
          } else if (formatPanel === 2) {
             setSelAudioIdx(audioIdx);
             setFormatPanel(3);
          } else if (formatPanel === 3) {
             setSelQualityIdx(qualityIdx);
             setActiveTab(4); setActiveField(0);
          }
        }
      }
    }
    else if (activeTab === 4) { // Export
      if (activeField === 0) {
         if (key.upArrow) setActiveField(-1);
         else if (key.return && exportPhase === 'ready') {
            setExportPhase('exporting');
            setIsProcessing(true);
            setError(null);
            setExportProgress(0);
            
            handleFinalExecution(
              trimStart, trimEnd,
              selAspectIdx, selScaleIdx, selResIdx,
              resizeCustomAspectW, resizeCustomAspectH, resizeCustomResW, resizeCustomResH,
              selFormatIdx, selCodecIdx, selAudioIdx, selQualityIdx,
              chosenFileName, outputPathIndex, customPath,
              (pct) => setExportProgress(pct),
              (outPath) => {
                setExportPhase('done');
                setIsProcessing(false);
              },
              (err) => {
                setExportPhase('ready');
                setIsProcessing(false);
                setError(err);
              }
            ).catch(() => {
                setIsProcessing(false);
                setExportPhase('ready');
                setError(friendlyError);
            });
         }
         else if (key.return && exportPhase === 'done') {
             setExportPhase('ready');
             setExportProgress(0);
             setError(null);
             setIsProcessing(false);
             setActiveTab(0);
             setActiveField(0);
         }
         else if (exportPhase === 'done' && (input === 'q' || input === 'Q')) {
             exit();
         }
      }
    }
  });

  const renderFilesView = () => (
    React.createElement(Box, { width: "100%", flexDirection: "column", flexGrow: 1 },
      React.createElement(Box, { height: 3, width: "100%", borderStyle: "single", borderColor: activeField === 0 ? PRIMARY_COLOR : "gray", paddingX: 1, marginBottom: 0, flexShrink: 0 },
        query.length === 0 
          ? React.createElement(Text, { color: "gray" }, "> search files...")
          : React.createElement(Text, { color: activeField === 0 ? PRIMARY_COLOR : "white" }, `> ${query.length > 80 ? query.slice(0, 77) + "..." : query}`)
      ),
      React.createElement(Box, { width: "100%", flexGrow: 1, gap: size.columns >= 85 ? 1 : 0, flexDirection: 'row', overflow: "hidden" },
        React.createElement(Box, { flexDirection: "column", flexGrow: 3, borderStyle: "single", borderColor: activeField === 1 ? PRIMARY_COLOR : "gray", overflow: "hidden" },
          React.createElement(Box, { paddingX: 1, flexShrink: 0 },
            React.createElement(Box, { flexGrow: 1 }, React.createElement(Text, { color: "gray", underline: true }, "NAME")),
            React.createElement(Box, { width: 10 }, React.createElement(Text, { color: "gray", underline: true }, "SIZE")),
            React.createElement(Box, { width: 8 }, React.createElement(Text, { color: "gray", underline: true }, "LEN"))
          ),
          React.createElement(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1, overflow: "hidden" },
            filteredFiles.length === 0 ? React.createElement(Text, { color: "gray" }, "  No matches.") :
            filteredFiles.map((file, index) => {
              const isFocused = activeFileIdx === index && activeField === 1;
              const isChosen = chosenFileName === file.name;
              let color = isFocused ? PRIMARY_COLOR : (isChosen ? 'white' : 'gray');
              const pointer = isFocused ? '❯ ' : '  ';
              return React.createElement(Box, { key: file.name },
                React.createElement(Box, { flexGrow: 1 }, React.createElement(Text, { color, wrap: "truncate-end" }, `${pointer}${file.name}`)),
                React.createElement(Box, { width: 10 }, React.createElement(Text, { color }, file.size)),
                React.createElement(Box, { width: 8 }, React.createElement(Text, { color }, file.duration))
              );
            })
          )
        ),
        size.columns >= 85 && React.createElement(Box, { width: 30, flexDirection: "column", borderStyle: "single", borderColor: "gray", flexShrink: 0 },
          React.createElement(Box, { paddingX: 1 }, React.createElement(Text, { color: "gray", underline: true }, "INFO")),
          React.createElement(Box, { flexDirection: "column", paddingX: 1 },
            React.createElement(Text, { color: "gray" }, currentFile.resolution),
            React.createElement(Text, { color: "gray" }, `Ratio: `, React.createElement(Text, { color: "white" }, currentFile.ratio)),
            React.createElement(Text, { color: "gray" }, `Size: `, React.createElement(Text, { color: "white" }, currentFile.size)),
            React.createElement(Text, { color: "gray" }, `Duration: `, React.createElement(Text, { color: "white" }, currentFile.duration))
          )
        )
      ),
      (size.rows >= 20 && size.columns >= 50) && React.createElement(Box, { height: 3, width: "100%", borderStyle: "single", borderColor: activeField === 2 ? PRIMARY_COLOR : "gray", paddingX: 1, flexShrink: 0 },
        React.createElement(Text, null,
          React.createElement(Text, { color: "gray" }, "Output: "),
          React.createElement(Text, { color: (activeField === 2 && outputPathIndex === 0) ? PRIMARY_COLOR : (outputPathIndex === 0 ? 'white' : 'gray') }, ` [${outputPathIndex === 0 ? 'x' : ' '}] Same as input   `),
          React.createElement(Text, { color: (activeField === 2 && outputPathIndex === 1) ? PRIMARY_COLOR : (outputPathIndex === 1 ? 'white' : 'gray') }, ` [${outputPathIndex === 1 ? 'x' : ' '}] ` + (outputPathIndex === 1 ? (customPath.length > 50 ? customPath.slice(0, 47) + "..." : (customPath || "type path or paste (ctrl+v/right-click)")) : "Custom path or paste (ctrl+v/right-click)..."))
        )
      )
    )
  );

  const renderResizeView = () => {
    const aspectStr = resizeAspectIdx === 0 ? "Original" : (resizeAspectIdx === 5 ? `${resizeCustomAspectW || '?'}:${resizeCustomAspectH || '?'}` : ASPECT_OPTIONS[resizeAspectIdx]);
    const resStr = resizeResIdx === 0 ? "Original" : (resizeResIdx === 4 ? `${resizeCustomResW || '?'}x${resizeCustomResH || '?'}` : RES_OPTIONS[resizeResIdx]);
    const hasScaleMode = selAspectIdx !== 0;
    let ratioStr = resizeAspectIdx === 0 ? currentFile.ratio || "16:9" : (resizeAspectIdx === 1 ? "16:9" : (resizeAspectIdx === 2 ? "9:16" : (resizeAspectIdx === 3 ? "1:1" : (resizeAspectIdx === 4 ? "4:3" : `${resizeCustomAspectW || 16}:${resizeCustomAspectH || 9}`))));
    const parts = ratioStr.split(':').map(Number);
    const targetRatio = (parts.length === 2 && parts[0] > 0 && parts[1] > 0) ? parts[0] / parts[1] : 16/9;
    let previewW = Math.round(targetRatio * 10 * 2), previewH = 10;
    if (previewW > 26) { previewW = 26; previewH = Math.round(26 / (targetRatio * 2)); }
    previewW = Math.max(12, previewW); previewH = Math.max(4, previewH);

    return React.createElement(Box, { width: "100%", flexGrow: 1, flexDirection: "row", paddingX: 1, gap: 1 },
      React.createElement(Box, { width: 30, borderStyle: "single", borderColor: "gray", flexDirection: "column", alignItems: "center", justifyContent: "center" },
         React.createElement(Box, { borderStyle: "round", borderColor: PRIMARY_COLOR, width: previewW, height: previewH, flexDirection: "column", alignItems: "center", justifyContent: "center" },
            React.createElement(Text, { color: PRIMARY_COLOR, bold: true }, aspectStr),
            React.createElement(Text, { color: "gray" }, resStr)
         )
      ),
      React.createElement(Box, { flexGrow: 1, flexDirection: "row", gap: 1 },
         React.createElement(Box, { flexGrow: 1, borderStyle: "single", borderColor: (activeField === 0 && resizePanel === 0) ? PRIMARY_COLOR : "gray", flexDirection: "column", overflow: "hidden" },
            React.createElement(Box, { paddingX: 1, borderBottom: false }, React.createElement(Text, { color: "gray" }, "ASPECT RATIO")),
            React.createElement(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1 },
               ASPECT_OPTIONS.map((opt, i) => {
                  const isFocused = (activeField === 0 && resizePanel === 0 && resizeFocus === 'list' && resizeAspectIdx === i);
                  return React.createElement(Text, { key: i, color: isFocused ? PRIMARY_COLOR : (selAspectIdx === i ? "white" : "gray") }, isFocused ? `> ${opt}` : `  ${opt}`);
               })
            ),
            resizeAspectIdx === 5 ? React.createElement(Box, { paddingX: 1, marginBottom: 0, flexDirection: "row", gap: 1 },
               React.createElement(Box, { borderStyle: "single", borderColor: (activeField === 0 && resizePanel === 0 && resizeFocus === 'customW') ? PRIMARY_COLOR : "gray", paddingX: 1 },
                  React.createElement(Text, { color: (activeField === 0 && resizePanel === 0 && resizeFocus === 'customW') ? PRIMARY_COLOR : "white" }, (resizeCustomAspectW || " ") + (activeField === 0 && resizePanel === 0 && resizeFocus === 'customW' ? "_" : ""))
               ),
               React.createElement(Box, { justifyContent: "center", alignItems: "center" }, React.createElement(Text, { color: "gray" }, "x")),
               React.createElement(Box, { borderStyle: "single", borderColor: (activeField === 0 && resizePanel === 0 && resizeFocus === 'customH') ? PRIMARY_COLOR : "gray", paddingX: 1 },
                  React.createElement(Text, { color: (activeField === 0 && resizePanel === 0 && resizeFocus === 'customH') ? PRIMARY_COLOR : "white" }, (resizeCustomAspectH || " ") + (activeField === 0 && resizePanel === 0 && resizeFocus === 'customH' ? "_" : ""))
               )
            ) : React.createElement(Box, { height: 3 })
         ),
         hasScaleMode && React.createElement(Box, { flexGrow: 1, borderStyle: "single", borderColor: (activeField === 0 && resizePanel === 1) ? PRIMARY_COLOR : "gray", flexDirection: "column" },
            React.createElement(Box, { paddingX: 1 }, React.createElement(Text, { color: "gray" }, "SCALE MODE")),
            React.createElement(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1 },
               ['Fit (letterbox)', 'Fill (crop)', 'Stretch'].map((opt, i) => {
                  const isFocused = (activeField === 0 && resizePanel === 1 && resizeScaleIdx === i);
                  return React.createElement(Text, { key: i, color: isFocused ? PRIMARY_COLOR : (selScaleIdx === i ? "white" : "gray") }, isFocused ? `> ${opt}` : `  ${opt}`);
               })
            )
         ),
         React.createElement(Box, { flexGrow: 1, borderStyle: "single", borderColor: (activeField === 0 && resizePanel === 2) ? PRIMARY_COLOR : "gray", flexDirection: "column" },
            React.createElement(Box, { paddingX: 1 }, React.createElement(Text, { color: "gray" }, "RESOLUTION")),
            React.createElement(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1 },
               RES_OPTIONS.map((opt, i) => {
                  const isFocused = (activeField === 0 && resizePanel === 2 && resizeFocus === 'list' && resizeResIdx === i);
                  return React.createElement(Text, { key: i, color: isFocused ? PRIMARY_COLOR : (selResIdx === i ? "white" : "gray") }, isFocused ? `> ${opt}` : `  ${opt}`);
               })
            ),
            resizeResIdx === 4 ? React.createElement(Box, { paddingX: 1, marginBottom: 0, flexDirection: "row", gap: 1 },
               React.createElement(Box, { borderStyle: "single", borderColor: (activeField === 0 && resizePanel === 2 && resizeFocus === 'customW') ? PRIMARY_COLOR : "gray", paddingX: 1 },
                  React.createElement(Text, { color: (activeField === 0 && resizePanel === 2 && resizeFocus === 'customW') ? PRIMARY_COLOR : "white" }, (resizeCustomResW || " ") + (activeField === 0 && resizePanel === 2 && resizeFocus === 'customW' ? "_" : ""))
               ),
               React.createElement(Box, { justifyContent: "center", alignItems: "center" }, React.createElement(Text, { color: "gray" }, "x")),
               React.createElement(Box, { borderStyle: "single", borderColor: (activeField === 0 && resizePanel === 2 && resizeFocus === 'customH') ? PRIMARY_COLOR : "gray", paddingX: 1 },
                  React.createElement(Text, { color: (activeField === 0 && resizePanel === 2 && resizeFocus === 'customH') ? PRIMARY_COLOR : "white" }, (resizeCustomResH || " ") + (activeField === 0 && resizePanel === 2 && resizeFocus === 'customH' ? "_" : ""))
               )
            ) : React.createElement(Box, { height: 3 })
         )
      )
    );
  };

  const renderFormatView = () => {
    const codecOptionsDisplay = ['Keep original', 'H.264', 'H.265 (HEVC)', 'ProRes', 'VP9', 'AV1'];
    const audioOptionsDisplay = ['Keep original', 'Convert to AAC', 'Remove audio'];

    return React.createElement(Box, { width: "100%", flexGrow: 1, flexDirection: "row", paddingX: 1, gap: 1 },
      React.createElement(Box, { width: "33%", flexGrow: 1, borderStyle: "single", borderColor: (activeField === 0 && formatPanel === 0) ? PRIMARY_COLOR : "gray", flexDirection: "column" },
         React.createElement(Box, { paddingX: 1, borderBottom: false }, React.createElement(Text, { color: "gray" }, "FORMAT")),
         React.createElement(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1 },
            FORMAT_OPTIONS.map((opt, i) => {
               const isFocused = (activeField === 0 && formatPanel === 0 && formatIdx === i);
               return React.createElement(Text, { key: i, color: isFocused ? PRIMARY_COLOR : (selFormatIdx === i ? "white" : "gray") }, isFocused ? `> ${opt}` : `  ${opt}`);
            })
         )
      ),
      React.createElement(Box, { width: "33%", flexGrow: 1, borderStyle: "single", borderColor: (activeField === 0 && formatPanel === 1) ? PRIMARY_COLOR : "gray", flexDirection: "column" },
         React.createElement(Box, { paddingX: 1 }, React.createElement(Text, { color: "gray" }, "VIDEO CODEC")),
         React.createElement(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1 },
            codecOptionsDisplay.map((opt, i) => {
               const isFocused = (activeField === 0 && formatPanel === 1 && codecIdx === i);
               return React.createElement(Text, { key: i, color: isFocused ? PRIMARY_COLOR : (selCodecIdx === i ? "white" : "gray") }, isFocused ? `> ${opt}` : `  ${opt}`);
            })
         )
      ),
      React.createElement(Box, { width: "33%", flexGrow: 1, flexDirection: "column" },
         React.createElement(Box, { flexGrow: 1, borderStyle: "single", borderColor: (activeField === 0 && formatPanel === 2) ? PRIMARY_COLOR : "gray", flexDirection: "column" },
            React.createElement(Box, { paddingX: 1 }, React.createElement(Text, { color: "gray" }, "AUDIO")),
            React.createElement(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1 },
               audioOptionsDisplay.map((opt, i) => {
                  const isFocused = (activeField === 0 && formatPanel === 2 && audioIdx === i);
                  return React.createElement(Text, { key: i, color: isFocused ? PRIMARY_COLOR : (selAudioIdx === i ? "white" : "gray") }, isFocused ? `> ${opt}` : `  ${opt}`);
               })
            )
         ),
         React.createElement(Box, { height: 5, borderStyle: "single", borderColor: (activeField === 0 && formatPanel === 3) ? PRIMARY_COLOR : "gray", flexDirection: "column", flexShrink: 0, justifyContent: "center" },
            React.createElement(Box, { paddingX: 1, flexDirection: "row", justifyContent: "space-between" }, 
               React.createElement(Text, { color: "gray" }, "QUALITY"),
               React.createElement(Text, { color: (activeField === 0 && formatPanel === 3) ? PRIMARY_COLOR : "white" }, `${(activeField === 0 && formatPanel === 3 ? qualityIdx : selQualityIdx) + 1}`)
            ),
            React.createElement(Box, { flexDirection: "row", paddingX: 1, marginTop: 1, justifyContent: "space-between" },
               React.createElement(Text, { color: "gray" }, "1"),
               React.createElement(Box, { flexDirection: "row", flexGrow: 1, justifyContent: "center" },
                  React.createElement(Text, null, Array.from({ length: 10 }).map((_, i) => {
                        const isActive = i <= (activeField === 0 && formatPanel === 3 ? qualityIdx : selQualityIdx);
                        const isHighlight = activeField === 0 && formatPanel === 3;
                        return React.createElement(Text, { key: i, color: isActive ? (isHighlight ? PRIMARY_COLOR : "white") : "gray", dimColor: !isActive }, i < 9 ? "█ " : "█");
                  }))
               ),
               React.createElement(Text, { color: "gray" }, "10")
            )
         )
      )
    );
  };

  const renderExportView = () => {
     const formatStr = selFormatIdx === 0 ? "Original" : FORMAT_OPTIONS[selFormatIdx];
     const codecStr = selCodecIdx === 0 ? "Copy" : ['H.264', 'H.265 (HEVC)', 'ProRes', 'VP9', 'AV1'][selCodecIdx - 1];
     const audioStr = selAudioIdx === 0 ? "Keep" : (selAudioIdx === 1 ? "Convert (AAC)" : "Remove");
     const aspectStrFinal = selAspectIdx === 0 ? "Original" : (selAspectIdx === 5 ? `${resizeCustomAspectW || '?'}:${resizeCustomAspectH || '?'}` : ASPECT_OPTIONS[selAspectIdx]);
     const scaleStrFinal = selAspectIdx === 0 ? "-" : ['Fit', 'Fill', 'Stretch'][selScaleIdx];
     const resStrFinal = selResIdx === 0 ? "Original" : (selResIdx === 4 ? `${resizeCustomResW || '?'}x${resizeCustomResH || '?'}` : RES_OPTIONS[selResIdx]);
     const barWidth = Math.max(20, Math.min(80, size.columns - 10));
     const filledBars = Math.floor((exportProgress / 100) * barWidth);
     const emptyBars = barWidth - filledBars;

     return React.createElement(Box, { width: "100%", flexGrow: 1, flexDirection: "column", paddingX: 1, justifyContent: "center" },
        error && React.createElement(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginBottom: 1 }, React.createElement(Text, { color: "red" }, `Error: ${error}`)),
        React.createElement(Box, { borderStyle: "single", borderColor: "gray", flexDirection: "column", paddingX: 2, paddingY: 1, marginBottom: 1 },
           React.createElement(Box, { width: "100%", justifyContent: "space-between", flexDirection: "row" },
               React.createElement(Box, { flexDirection: "column" },
                  React.createElement(Text, { color: "gray" }, `Input: `, React.createElement(Text, { color: "white", bold: true }, currentFile.name)),
                  React.createElement(Text, { color: "gray" }, `Trim: `, React.createElement(Text, { color: "white" }, `${trimStart} - ${trimEnd}`)),
                  React.createElement(Text, { color: "gray" }, `Format: `, React.createElement(Text, { color: "white" }, formatStr))
               ),
               React.createElement(Box, { flexDirection: "column" },
                  React.createElement(Text, { color: "gray" }, `Aspect: `, React.createElement(Text, { color: "white" }, aspectStrFinal)),
                  React.createElement(Text, { color: "gray" }, `Scale: `, React.createElement(Text, { color: "white" }, scaleStrFinal)),
                  React.createElement(Text, { color: "gray" }, `Res: `, React.createElement(Text, { color: "white" }, resStrFinal))
               ),
               React.createElement(Box, { flexDirection: "column" },
                  React.createElement(Text, { color: "gray" }, `Codec: `, React.createElement(Text, { color: "white" }, codecStr)),
                  React.createElement(Text, { color: "gray" }, `Quality: `, React.createElement(Text, { color: "white" }, `${selQualityIdx + 1}/10`)),
                  React.createElement(Text, { color: "gray" }, `Audio: `, React.createElement(Text, { color: "white" }, audioStr))
               )
           )
        ),
        exportPhase === 'ready' && React.createElement(Box, { borderStyle: "single", borderColor: activeField === 0 ? PRIMARY_COLOR : "gray", justifyContent: "center", paddingY: 1 },
           React.createElement(Text, { color: activeField === 0 ? PRIMARY_COLOR : "gray", bold: true }, "[ Press Enter to Start Export ]")
        ),
        exportPhase === 'exporting' && React.createElement(Box, { width: "100%", justifyContent: "center" },
           React.createElement(Box, { width: barWidth + 4, borderStyle: "single", borderColor: PRIMARY_COLOR, flexDirection: "column", paddingY: 1, paddingX: 2 },
              React.createElement(Box, { justifyContent: "space-between", marginBottom: 1 },
                 React.createElement(Text, { color: "cyan" }, "Processing..."),
                 React.createElement(Text, { color: "white" }, `${Math.floor(exportProgress)}%`)
              ),
              React.createElement(Text, { color: PRIMARY_COLOR }, "█".repeat(filledBars) + "─".repeat(emptyBars))
           )
        ),
        exportPhase === 'done' && React.createElement(Box, { borderStyle: "single", borderColor: "green", flexDirection: "column", justifyContent: "center", alignItems: "center", paddingY: 1, paddingX: 2 },
           React.createElement(Text, { color: "green", bold: true }, "Export Complete!"),
           React.createElement(Text, { color: "gray", marginTop: 1 }, "Thank you for using SVEC."),
           React.createElement(Text, { color: "white", marginTop: 1 }, "[Enter] Start New Conversion • [Q] Quit")
        )
     );
  };

  const renderActiveView = () => {
    if (activeTab === 0) return renderFilesView();
    if (activeTab === 2) return renderResizeView();
    if (activeTab === 3) return renderFormatView();
    if (activeTab === 4) return renderExportView();
    if (activeTab === 1) {
        const totalS = toSec(currentFile.duration), startS = toSec(trimStart), endS = Math.min(toSec(trimEnd), totalS);
        const startPct = Math.max(0, Math.min(100, (startS / totalS) * 100)), endPct = Math.max(0, Math.min(100, (endS / totalS) * 100));
        const barWidth = Math.max(20, Math.min(80, size.columns - 30));
        return (
          React.createElement(Box, { width: "100%", flexGrow: 1, flexDirection: "column" },
            React.createElement(Box, { flexGrow: 1 }),
            React.createElement(Box, { flexDirection: "column", alignItems: "center" },
              size.rows >= 14 && React.createElement(Box, { marginBottom: size.rows >= 26 ? 1 : 0 },
                React.createElement(Text, { color: "gray" }, "File: "), React.createElement(Text, { color: "white", bold: true }, currentFile.name),
                React.createElement(Text, { color: "gray" }, " ("), React.createElement(Text, { color: "cyan" }, currentFile.duration), React.createElement(Text, { color: "gray" }, ")")
              ),
              size.rows >= 10 && React.createElement(Box, { width: barWidth + 6, flexDirection: "column", borderStyle: "single", borderColor: "gray", paddingX: 2, paddingY: 1 },
                React.createElement(Box, { width: "100%", justifyContent: "center" },
                  Array.from({ length: barWidth }).map((_, i) => {
                    const p = (i / barWidth) * 100;
                    return React.createElement(Text, { key: i, color: (p >= startPct && p < endPct) ? "white" : "gray", dimColor: !(p >= startPct && p < endPct) }, "█");
                  })
                )
              ),
              size.rows >= 10 && React.createElement(Box, { width: "100%", justifyContent: "center" },
                React.createElement(Text, { color: "gray" }, `Selection: ${Math.max(0, Math.round(endPct - startPct))}%`)
              ),
              React.createElement(Box, { height: 3, marginTop: size.rows >= 26 ? 1 : 0, justifyContent: "center", alignItems: "center" },
                React.createElement(Box, { gap: 8, justifyContent: "center", alignItems: "center" },
                  React.createElement(Box, { borderStyle: "single", borderColor: activeField === 0 ? PRIMARY_COLOR : "gray", paddingX: 2 },
                    React.createElement(Text, { color: activeField === 0 ? PRIMARY_COLOR : "gray" }, "Start Time: "),
                    React.createElement(Text, { color: activeField === 0 ? PRIMARY_COLOR : "white", bold: activeField === 0 }, trimStart)
                  ),
                  React.createElement(Box, { borderStyle: "single", borderColor: activeField === 1 ? PRIMARY_COLOR : "gray", paddingX: 2 },
                    React.createElement(Text, { color: activeField === 1 ? PRIMARY_COLOR : "gray" }, "End Time: "),
                    React.createElement(Text, { color: activeField === 1 ? PRIMARY_COLOR : "white", bold: activeField === 1 }, trimEnd)
                  )
                )
              )
            ),
            React.createElement(Box, { flexGrow: 1 })
          )
        );
    }
    return React.createElement(Box, { flexGrow: 1, alignItems: "center", justifyContent: "center" }, React.createElement(Text, { color: "gray" }, `${TABS[activeTab]} View Mockup`));
  };

  const showLogo = size.rows >= 30;
  const showSubtitle = size.rows >= 20;

  return React.createElement(Box, { width: size.columns, height: size.rows, flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" },
    (showLogo || showSubtitle) && React.createElement(Box, { flexDirection: "column", alignItems: "center", marginBottom: 1 },
      showLogo && React.createElement(Box, { flexDirection: "column", alignItems: "center", marginBottom: 1 }, 
        SVEC_LOGO.split('\n').map((line, idx) => React.createElement(Text, { key: idx, color: "cyan" }, line))
      ),
      showSubtitle && React.createElement(Text, { color: "gray" }, "SVEC • Simplest Video Editor CLI • v1.1.2")
    ),
    React.createElement(Box, { width: Math.min(size.columns - 4, 110), height: Math.max(18, Math.min(26, size.rows - (showLogo ? 10 : 2))), borderStyle: "round", borderColor: activeField === -1 ? PRIMARY_COLOR : "gray", flexDirection: "column", paddingX: 1, overflow: "hidden" },
      React.createElement(Box, { width: "100%", justifyContent: "space-between", flexShrink: 0 },
        React.createElement(Box, null, TABS.map((tab, index) => {
          const color = (activeTab === index && activeField === -1) ? PRIMARY_COLOR : (activeTab === index ? 'white' : 'gray');
          return React.createElement(Box, { key: tab, marginRight: 2 }, React.createElement(Text, { color, bold: (activeTab === index && activeField === -1) }, `[${tab}]`));
        })),
        React.createElement(Text, { color: "gray" }, `${activeTab + 1}/${TABS.length}`)
      ),
      React.createElement(Box, { width: "100%", flexGrow: 1, flexDirection: "column", overflow: "hidden" }, renderActiveView()),
      size.rows >= 22 && React.createElement(Box, { width: "100%", justifyContent: "space-between", flexShrink: 0 },
        React.createElement(Text, { color: "gray" }, "SVEC TUI"),
        React.createElement(Text, { color: "gray" }, "[Arrows] Nav • [Enter] Accept • [Esc] Exit")
      )
    )
  );
};

process.stdout.write('\x1b[?1049h');
try {
  const { waitUntilExit } = render(React.createElement(App), { exitOnCtrlC: false, enterFullscreen: true });
  waitUntilExit().then(() => { process.stdout.write('\x1b[?1049l'); process.exit(0); });
} catch (e) { process.stdout.write('\x1b[?1049l'); console.error(e); }
