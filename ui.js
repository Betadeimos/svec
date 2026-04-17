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
             setActiveField(-1); 
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

  const renderActiveView = () => {
    if (activeTab === 0) return renderFilesView();
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
