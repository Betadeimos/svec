import { render, Box, Text, useInput, useApp } from 'ink';
import React, { useState, useEffect } from 'react';

const SVEC_LOGO = `███████╗██╗   ██╗███████╗ ██████╗
██╔════╝██║   ██║██╔════╝██╔════╝
███████╗██║   ██║█████╗  ██║     
╚════██║╚██╗ ██╔╝██╔══╝  ██║     
███████║ ╚████╔╝ ███████╗╚██████╗
╚══════╝  ╚═══╝  ╚══════╝ ╚═════╝`;

const TABS = ['Files', 'Trim', 'Resize', 'Format', 'Export'];

const mockFiles = [
  { name: "vacation_2024.mp4", size: "1.2 GB", duration: "02:34", resolution: "1920x1080", ratio: "16:9" },
  { name: "interview.mov", size: "4.5 GB", duration: "01:15", resolution: "3840x2160", ratio: "16:9" },
  { name: "product_demo.mp4", size: "256 MB", duration: "05:30", resolution: "1920x1080", ratio: "16:9" },
  { name: "wedding.mp4", size: "8.2 GB", duration: "03:45", resolution: "1920x1080", ratio: "16:9" },
  { name: "tutorial.webm", size: "890 MB", duration: "45:22", resolution: "1280x720", ratio: "16:9" },
  { name: "drone_4k.mp4", size: "12.1 GB", duration: "12:45", resolution: "3840x2160", ratio: "16:9" },
];

const outputOptions = ["Same as input", "Custom path..."];
const PRIMARY_COLOR = '#00DFFF';

const App = () => {
  const { exit } = useApp();
  const [activeTab, setActiveTab] = useState(0);
  const [activeFileIdx, setActiveFileIdx] = useState(0); 
  const [chosenFileName, setChosenFileName] = useState(mockFiles[0].name); 
  const [activeField, setActiveField] = useState(1); 
  
  const [query, setQuery] = useState("");               
  const [customPath, setCustomPath] = useState("");     
  
  const [trimStart, setTrimStart] = useState("00:00");
  const [trimEnd, setTrimEnd] = useState("05:30");
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
  
  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: (process.stdout.rows || 24) - 1,
  });

  useEffect(() => {
    const onResize = () => setSize({ columns: process.stdout.columns, rows: process.stdout.rows - 1 });
    process.stdout.on('resize', onResize);
    return () => process.stdout.off('resize', onResize);
  }, []);

  const filteredFiles = mockFiles.filter(f => f.name.toLowerCase().includes(query.toLowerCase()));
  const currentFile = mockFiles.find(f => f.name === chosenFileName) || mockFiles[0];

  useEffect(() => {
    setTrimStart("00:00");
    setTrimEnd(currentFile.duration);
  }, [currentFile.name]);

  const showLogo = size.rows >= 30;
  const showSubtitle = size.rows >= 20;
  const showFooter = size.rows >= 22;
  const showInfo = size.columns >= 85;
  const showOutput = size.rows >= 20 && size.columns >= 50;

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
           if (query.trim() && filteredFiles.length > 0) {
               setChosenFileName(filteredFiles[0].name);
               setActiveField(2); 
           } else setActiveField(1);
        }
        if (key.backspace) { setQuery(prev => prev.slice(0, -1)); setActiveFileIdx(0); }
        else if (input && !key.ctrl && !key.meta && input.length === 1) { 
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
          else if (showOutput) setActiveField(2);
        }
        if (key.return) {
          if (filteredFiles[activeFileIdx]) setChosenFileName(filteredFiles[activeFileIdx].name);
          if (showOutput) setActiveField(2);
          else { setActiveTab(1); setActiveField(0); }
        }
      }
      else if (activeField === 2) { // Output
        if (key.upArrow) setActiveField(1);
        if (key.leftArrow || key.rightArrow) setOutputPathIndex(prev => (prev === 0 ? 1 : 0));
        
        if (outputPathIndex === 1) {
            if (key.backspace) setCustomPath(prev => prev.slice(0, -1));
            else if (input && !key.ctrl && !key.meta && input.length === 1) setCustomPath(prev => prev + input);
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
        const parseT = (t) => { 
          if (!t) return 0;
          const parts = t.split(':').map(Number);
          if (parts.length === 1) return parts[0] || 0;
          return (parts[0]||0)*60 + (parts[1]||0); 
        };
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
            const totalS = parseT(currentFile.duration);
            if (activeField === 0) {
              const newS = Math.max(0, Math.min(parseT(trimStart) + delta, parseT(trimEnd) - 1));
              setTrimStart(formatT(newS));
            } else {
              const newE = Math.max(parseT(trimStart) + 1, Math.min(parseT(trimEnd) + delta, totalS));
              setTrimEnd(formatT(newE));
            }
          }
        }
        if (key.return) {
          if (activeField === 0) {
             setTrimStart(formatT(parseT(trimStart)));
             setActiveField(1);
          }
          else { 
             setTrimEnd(formatT(parseT(trimEnd)));
             setActiveTab(2); setActiveField(0); 
          }
        }
      }
    }
    else if (activeTab === 2) { // Resize
      if (activeField === 0) {
        const hasScaleMode = selAspectIdx !== 0; // Scale Mode panel only shows if selected aspect ratio is not Original
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
  });

  const renderFilesView = () => (
    React.createElement(Box, { width: "100%", flexDirection: "column", flexGrow: 1 },
      // Search Box (Fixed height 3)
      React.createElement(Box, { height: 3, width: "100%", borderStyle: "single", borderColor: activeField === 0 ? PRIMARY_COLOR : "gray", paddingX: 1, marginBottom: 0, flexShrink: 0 },
        query.length === 0 
          ? React.createElement(Text, { color: "gray" }, "> search files...")
          : React.createElement(Text, { color: activeField === 0 ? PRIMARY_COLOR : "white" }, `> ${query.length > 80 ? query.slice(0, 77) + "..." : query}`)
      ),
      // Middle Section (Flexible)
      React.createElement(Box, { width: "100%", flexGrow: 1, gap: showInfo ? 1 : 0, flexDirection: 'row', overflow: "hidden" },
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
        showInfo && React.createElement(Box, { width: 30, flexDirection: "column", borderStyle: "single", borderColor: "gray", flexShrink: 0 },
          React.createElement(Box, { paddingX: 1 }, React.createElement(Text, { color: "gray", underline: true }, "INFO")),
          React.createElement(Box, { flexDirection: "column", paddingX: 1 },
            React.createElement(Text, { color: "gray" }, currentFile.resolution),
            React.createElement(Text, { color: "gray" }, `Ratio: `, React.createElement(Text, { color: "white" }, currentFile.ratio)),
            React.createElement(Text, { color: "gray" }, `Size: `, React.createElement(Text, { color: "white" }, currentFile.size)),
            React.createElement(Text, { color: "gray" }, `Duration: `, React.createElement(Text, { color: "white" }, currentFile.duration))
          )
        )
      ),
      // Output Box (Fixed height 3)
      showOutput && React.createElement(Box, { height: 3, width: "100%", borderStyle: "single", borderColor: activeField === 2 ? PRIMARY_COLOR : "gray", paddingX: 1, flexShrink: 0 },
        React.createElement(Text, null,
          React.createElement(Text, { color: "gray" }, "Output: "),
          React.createElement(Text, { color: (activeField === 2 && outputPathIndex === 0) ? PRIMARY_COLOR : (outputPathIndex === 0 ? 'white' : 'gray') }, ` [${outputPathIndex === 0 ? 'x' : ' '}] Same as input   `),
          React.createElement(Text, { color: (activeField === 2 && outputPathIndex === 1) ? PRIMARY_COLOR : (outputPathIndex === 1 ? 'white' : 'gray') }, ` [${outputPathIndex === 1 ? 'x' : ' '}] ` + (outputPathIndex === 1 ? (customPath.length > 50 ? customPath.slice(0, 47) + "..." : (customPath || "type path...")) : "Custom path..."))
        )
      )
    )
  );

  const renderResizeView = () => {
    const aspectOptions = ['Original', '16:9', '9:16', '1:1', '4:3', 'Custom'];
    const scaleOptions = ['Fit (letterbox)', 'Fill (crop)', 'Stretch'];
    const resOptions = ['Original', '720p', '1080p', '4K', 'Custom'];
    
    // Live preview strings based on HOVER
    const aspectStr = resizeAspectIdx === 0 ? "Original" : 
                      (resizeAspectIdx === 5 ? `${resizeCustomAspectW || '?'}:${resizeCustomAspectH || '?'}` : aspectOptions[resizeAspectIdx]);
    const resStr = resizeResIdx === 0 ? "Original" :
                   (resizeResIdx === 4 ? `${resizeCustomResW || '?'}x${resizeCustomResH || '?'}` : resOptions[resizeResIdx]);

    const hasScaleMode = selAspectIdx !== 0;

    // Dynamic Preview Box Size Calculation
    let targetRatio = 16 / 9;
    let ratioStr = "16:9";
    if (resizeAspectIdx === 0) ratioStr = currentFile.ratio || "16:9";
    else if (resizeAspectIdx === 1) ratioStr = "16:9";
    else if (resizeAspectIdx === 2) ratioStr = "9:16";
    else if (resizeAspectIdx === 3) ratioStr = "1:1";
    else if (resizeAspectIdx === 4) ratioStr = "4:3";
    else if (resizeAspectIdx === 5) ratioStr = `${resizeCustomAspectW || 16}:${resizeCustomAspectH || 9}`;

    const parts = ratioStr.split(':').map(Number);
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
       targetRatio = parts[0] / parts[1];
    }
    
    // Terminal characters are ~ 1:2 physical aspect ratio
    // Box dimensions in terminal chars: width=cols, height=rows
    // Physical Ratio = cols / (rows * 2) => cols = Ratio * rows * 2
    const maxCols = 26;
    const maxRows = 10;
    
    let previewW = Math.round(targetRatio * maxRows * 2);
    let previewH = maxRows;
    
    if (previewW > maxCols) {
        previewW = maxCols;
        previewH = Math.round(maxCols / (targetRatio * 2));
    }
    
    previewW = Math.max(12, previewW);
    previewH = Math.max(4, previewH);

    return React.createElement(Box, { width: "100%", flexGrow: 1, flexDirection: "row", paddingX: 1, gap: 1 },
      // Preview panel (left)
      React.createElement(Box, { width: 30, borderStyle: "single", borderColor: "gray", flexDirection: "column", alignItems: "center", justifyContent: "center" },
         React.createElement(Box, { borderStyle: "round", borderColor: PRIMARY_COLOR, width: previewW, height: previewH, flexDirection: "column", alignItems: "center", justifyContent: "center" },
            React.createElement(Text, { color: PRIMARY_COLOR, bold: true }, aspectStr),
            React.createElement(Text, { color: "gray" }, resStr)
         )
      ),
      // Controls panel
      React.createElement(Box, { flexGrow: 1, flexDirection: "row", gap: 1 },
         // Aspect Ratio
         React.createElement(Box, { flexGrow: 1, borderStyle: "single", borderColor: (activeField === 0 && resizePanel === 0) ? PRIMARY_COLOR : "gray", flexDirection: "column", overflow: "hidden" },
            React.createElement(Box, { paddingX: 1, borderBottom: false }, React.createElement(Text, { color: "gray" }, "ASPECT RATIO")),
            React.createElement(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1 },
               aspectOptions.map((opt, i) => {
                  const isSelected = selAspectIdx === i;
                  const isHovered = resizeAspectIdx === i;
                  const isFocused = (activeField === 0 && resizePanel === 0 && resizeFocus === 'list' && isHovered);
                  return React.createElement(Text, { key: i, color: isFocused ? PRIMARY_COLOR : (isSelected ? "white" : "gray") }, isFocused ? `> ${opt}` : `  ${opt}`);
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
         // Scale Mode (conditional)
         hasScaleMode && React.createElement(Box, { flexGrow: 1, borderStyle: "single", borderColor: (activeField === 0 && resizePanel === 1) ? PRIMARY_COLOR : "gray", flexDirection: "column" },
            React.createElement(Box, { paddingX: 1 }, React.createElement(Text, { color: "gray" }, "SCALE MODE")),
            React.createElement(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1 },
               scaleOptions.map((opt, i) => {
                  const isSelected = selScaleIdx === i;
                  const isHovered = resizeScaleIdx === i;
                  const isFocused = (activeField === 0 && resizePanel === 1 && isHovered);
                  return React.createElement(Text, { key: i, color: isFocused ? PRIMARY_COLOR : (isSelected ? "white" : "gray") }, isFocused ? `> ${opt}` : `  ${opt}`);
               })
            )
         ),
         // Resolution
         React.createElement(Box, { flexGrow: 1, borderStyle: "single", borderColor: (activeField === 0 && resizePanel === 2) ? PRIMARY_COLOR : "gray", flexDirection: "column" },
            React.createElement(Box, { paddingX: 1 }, React.createElement(Text, { color: "gray" }, "RESOLUTION")),
            React.createElement(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1 },
               resOptions.map((opt, i) => {
                  const isSelected = selResIdx === i;
                  const isHovered = resizeResIdx === i;
                  const isFocused = (activeField === 0 && resizePanel === 2 && resizeFocus === 'list' && isHovered);
                  return React.createElement(Text, { key: i, color: isFocused ? PRIMARY_COLOR : (isSelected ? "white" : "gray") }, isFocused ? `> ${opt}` : `  ${opt}`);
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

  const renderActiveView = () => {
    if (activeTab === 0) return renderFilesView();
    if (activeTab === 2) return renderResizeView();
    if (activeTab === 1) {
        const parseT = (t) => { 
          if (!t) return 0;
          const parts = t.split(':').map(Number);
          if (parts.length === 1) return parts[0] || 0;
          return (parts[0]||0)*60 + (parts[1]||0); 
        };
        const totalS = parseT(currentFile.duration);
        const startS = parseT(trimStart);
        // Cap endS so the initial "05:30" state doesn't exceed total file duration
        const endS = Math.min(parseT(trimEnd), totalS);
        const startPct = Math.max(0, Math.min(100, (startS / totalS) * 100));
        const endPct = Math.max(0, Math.min(100, (endS / totalS) * 100));
        const barWidth = Math.max(20, Math.min(80, size.columns - 30));
        const renderBar = () => {
          const elements = [];
          for (let i = 0; i < barWidth; i++) {
            const p = (i / barWidth) * 100;
            if (p >= startPct && p < endPct) {
                elements.push(React.createElement(Text, { key: i, color: "white" }, "█"));
            } else {
                elements.push(React.createElement(Text, { key: i, color: "gray", dimColor: true }, "█"));
            }
          }
          return elements;
        };
        
        const isTall = size.rows >= 26;
        const showFileName = size.rows >= 14;
        const showTimeline = size.rows >= 10;

        return (
          React.createElement(Box, { width: "100%", flexGrow: 1, flexDirection: "column" },
            React.createElement(Box, { flexGrow: 1 }),
            React.createElement(Box, { flexDirection: "column", alignItems: "center" },
              
              showFileName && React.createElement(Box, { marginBottom: isTall ? 1 : 0 },
                React.createElement(Text, { color: "gray" }, "File: "),
                React.createElement(Text, { color: "white", bold: true }, currentFile.name),
                React.createElement(Text, { color: "gray" }, " ("),
                React.createElement(Text, { color: "cyan" }, currentFile.duration),
                React.createElement(Text, { color: "gray" }, ")")
              ),
              
              showTimeline && React.createElement(Box, { width: barWidth + 6, flexDirection: "column", borderStyle: "single", borderColor: "gray", paddingX: 2, paddingY: 1, marginBottom: 0 },
                React.createElement(Box, { width: "100%", justifyContent: "center", marginY: 0 },
                  renderBar()
                )
              ),
              
              showTimeline && React.createElement(Box, { width: "100%", justifyContent: "center", marginTop: 0, marginBottom: 0 },
                React.createElement(Text, { color: "gray" }, `Selection: ${Math.max(0, Math.round(endPct - startPct))}%`)
              ),
              
              React.createElement(Box, { gap: 8, justifyContent: "center", alignItems: "center", marginTop: isTall ? 1 : 0 },
                React.createElement(Box, { borderStyle: "single", borderColor: activeField === 0 ? PRIMARY_COLOR : "gray", paddingX: 2 },
                  React.createElement(Text, { color: activeField === 0 ? PRIMARY_COLOR : "gray" }, "Start Time: "),
                  React.createElement(Text, { color: activeField === 0 ? PRIMARY_COLOR : "white", bold: activeField === 0 }, trimStart + (activeField === 0 ? "_" : ""))
                ),
                React.createElement(Box, { borderStyle: "single", borderColor: activeField === 1 ? PRIMARY_COLOR : "gray", paddingX: 2 },
                  React.createElement(Text, { color: activeField === 1 ? PRIMARY_COLOR : "gray" }, "End Time: "),
                  React.createElement(Text, { color: activeField === 1 ? PRIMARY_COLOR : "white", bold: activeField === 1 }, trimEnd + (activeField === 1 ? "_" : ""))
                )
              )
            ),
            React.createElement(Box, { flexGrow: 1 })
          )
        );
    }
    return React.createElement(Box, { flexGrow: 1, alignItems: "center", justifyContent: "center" }, React.createElement(Text, { color: "gray" }, `${TABS[activeTab]} View Mockup`));
  };

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
          const isTabActive = activeTab === index;
          const isMenuFocused = activeField === -1;
          const color = (isTabActive && isMenuFocused) ? PRIMARY_COLOR : (isTabActive ? 'white' : 'gray');
          return React.createElement(Box, { key: tab, marginRight: 2 }, React.createElement(Text, { color, bold: isTabActive && isMenuFocused }, `[${tab}]`));
        })),
        React.createElement(Text, { color: "gray" }, `${activeTab + 1}/${TABS.length}`)
      ),
      React.createElement(Box, { width: "100%", flexGrow: 1, flexDirection: "column", overflow: "hidden" }, renderActiveView()),
      showFooter && React.createElement(Box, { width: "100%", justifyContent: "space-between", flexShrink: 0 },
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
