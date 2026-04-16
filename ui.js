import 'react';
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

const App = () => {
  const { exit } = useApp();
  const [activeTab, setActiveTab] = useState(0);
  const [activeFile, setActiveFile] = useState(0);
  const [activeField, setActiveField] = useState(0); // 0: search, 1: list, 2: output
  const [outputPathIndex, setOutputPathIndex] = useState(0);
  
  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: (process.stdout.rows || 24) - 1, // -1 for Windows overflow fix
  });

  useEffect(() => {
    const onResize = () => {
      setSize({
        columns: process.stdout.columns,
        rows: process.stdout.rows - 1,
      });
    };
    process.stdout.on('resize', onResize);
    return () => process.stdout.off('resize', onResize);
  }, []);

  // Breakpoints
  const showLogo = size.rows >= 28;
  const showSubtitle = size.rows >= 18;
  const showFooter = size.rows >= 22;
  const showInfo = size.columns >= 85;
  const showOutput = size.rows >= 20 && size.columns >= 50;

  useInput((input, key) => {
    if ((key.ctrl && input === 'q') || key.escape) {
      exit();
      return;
    }
    
    // Global Keyboard Navigation for Tabs
    if (key.tab || input === '\t' || key.return) {
      if (key.shift) {
        setActiveTab((prev) => (prev === 0 ? TABS.length - 1 : prev - 1));
      } else {
        setActiveTab((prev) => (prev === TABS.length - 1 ? 0 : prev + 1));
      }
      // Reset active field when switching tabs
      setActiveField(0);
      return;
    }

    // View-specific input handling (only for Files view for now)
    if (activeTab === 0) {
      if (activeField === 0) {
        // Search field interaction placeholder
      } else if (activeField === 1) { // List Focus
        if (key.upArrow) {
          setActiveFile((prev) => (prev === 0 ? mockFiles.length - 1 : prev - 1));
        }
        if (key.downArrow) {
          setActiveFile((prev) => (prev === mockFiles.length - 1 ? 0 : prev + 1));
        }
        if (key.rightArrow || key.leftArrow) {
          // Logic for shifting focus between fields within the view could go here
          // but for now we follow the global tab navigation requested.
        }
      } else if (activeField === 2) { // Output Path Focus
        if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
          setOutputPathIndex(prev => prev === 0 ? 1 : 0);
        }
      }
      
      // Local field navigation within Files view (optional, using arrow keys)
      if (key.downArrow && activeField === 0) setActiveField(1);
      if (key.upArrow && activeField === 1 && activeFile === 0) setActiveField(0);
      if (key.downArrow && activeField === 1 && activeFile === mockFiles.length - 1 && showOutput) setActiveField(2);
      if (key.upArrow && activeField === 2) setActiveField(1);
    }
  });

  const renderFilesView = () => (
    React.createElement(Box, { width: "100%", flexDirection: "column", flexGrow: 1, overflow: "hidden" },
      // Search Bar
      React.createElement(Box, { 
          width: "100%",
          borderStyle: "single", 
          borderColor: activeField === 0 ? "cyan" : "gray", 
          paddingX: 1, 
          marginBottom: 0, 
          flexShrink: 0,
          overflow: "hidden"
        },
        React.createElement(Text, { color: activeField === 0 ? "cyan" : "gray", wrap: "truncate" }, "> search files... (mock)")
      ),
      
      // Middle section: List & Metadata
      React.createElement(Box, { width: "100%", flexGrow: 1, gap: showInfo ? 1 : 0, flexDirection: 'row', overflow: "hidden" },
        // File List
        React.createElement(Box, { 
            flexDirection: "column", 
            flexGrow: 1, 
            borderStyle: "single", 
            borderColor: activeField === 1 ? "cyan" : "gray",
            overflow: "hidden"
          },
          // Header
          React.createElement(Box, { paddingX: 1, flexShrink: 0, marginBottom: 0, marginTop: 0 },
            React.createElement(Box, { flexGrow: 1 }, React.createElement(Text, { color: "gray", wrap: "truncate", underline: true }, "NAME")),
            React.createElement(Box, { width: 10, flexShrink: 0 }, React.createElement(Text, { color: "gray", wrap: "truncate", underline: true }, "SIZE")),
            React.createElement(Box, { width: 8, flexShrink: 0 }, React.createElement(Text, { color: "gray", wrap: "truncate", underline: true }, "LEN"))
          ),
          // Items
          React.createElement(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1, overflow: "hidden" },
            mockFiles.map((file, index) => {
              const isActive = activeFile === index;
              const color = isActive && activeField === 1 ? 'cyan' : (isActive ? 'white' : 'gray');
              const pointer = isActive && activeField === 1 ? '❯ ' : (isActive ? '> ' : '  ');
              
              return React.createElement(Box, { key: file.name, flexWrap: "nowrap", overflow: 'hidden' },
                React.createElement(Box, { flexGrow: 1, overflow: "hidden", marginRight: 1 },
                  React.createElement(Text, { color, wrap: "truncate-end" }, `${pointer}${file.name}`)
                ),
                React.createElement(Box, { width: 10, flexShrink: 0 },
                  React.createElement(Text, { color, wrap: "truncate-end" }, file.size)
                ),
                React.createElement(Box, { width: 8, flexShrink: 0 },
                  React.createElement(Text, { color, wrap: "truncate-end" }, file.duration)
                )
              );
            })
          )
        ),
        
        // Metadata Panel
        showInfo && React.createElement(Box, { 
            width: 30, 
            flexDirection: "column", 
            borderStyle: "single", 
            borderColor: "gray",
            flexShrink: 0,
            overflow: "hidden"
          },
          React.createElement(Box, { paddingX: 1, flexShrink: 0, marginBottom: 0 },
            React.createElement(Text, { color: "gray", wrap: "truncate", underline: true }, "INFO")
          ),
          React.createElement(Box, { flexDirection: "column", paddingX: 1, overflow: "hidden" },
            React.createElement(Text, { color: "gray", wrap: "truncate" }, mockFiles[activeFile].resolution),
            React.createElement(Text, { color: "gray", wrap: "truncate" }, `Ratio: `, React.createElement(Text, { color: "white" }, mockFiles[activeFile].ratio)),
            React.createElement(Text, { color: "gray", wrap: "truncate" }, `Size: `, React.createElement(Text, { color: "white" }, mockFiles[activeFile].size)),
            React.createElement(Text, { color: "gray", wrap: "truncate" }, `Duration: `, React.createElement(Text, { color: "white", wrap: "truncate" }, mockFiles[activeFile].duration))
          )
        )
      ),
      
      // Output Path
      showOutput && React.createElement(Box, { 
          width: "100%",
          marginTop: 0, 
          borderStyle: "single", 
          borderColor: activeField === 2 ? "cyan" : "gray", 
          paddingX: 1,
          flexShrink: 0,
          overflow: "hidden"
        },
        React.createElement(Text, { color: "gray", wrap: "truncate" }, "Output: "),
        outputOptions.map((opt, idx) => {
          const isSelected = outputPathIndex === idx;
          const isFocused = activeField === 2;
          const color = isSelected && isFocused ? 'cyan' : (isSelected ? 'white' : 'gray');
          return React.createElement(Text, { key: opt, color, wrap: "truncate" }, `[${isSelected ? 'x' : ' '}] ${opt}   `);
        })
      )
    )
  );

  const renderPlaceholderView = (title) => (
    React.createElement(Box, { width: "100%", flexGrow: 1, alignItems: "center", justifyContent: "center" },
      React.createElement(Text, { color: "gray" }, `${title} View Mockup`)
    )
  );

  const renderActiveView = () => {
    switch (activeTab) {
      case 0: return renderFilesView();
      case 1: return renderPlaceholderView('Trim');
      case 2: return renderPlaceholderView('Resize');
      case 3: return renderPlaceholderView('Format');
      case 4: return renderPlaceholderView('Export');
      default: return renderFilesView();
    }
  };

  return React.createElement(Box, { 
      width: size.columns, 
      height: size.rows, 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      overflow: "hidden" 
    },
    // LOGO & SUBTITLE 
    (showLogo || showSubtitle) && React.createElement(Box, { 
        flexShrink: 0, 
        flexDirection: "column", 
        alignItems: "center",
        width: "100%",
        marginBottom: 1 
      },
      showLogo && React.createElement(Box, { flexDirection: "column", alignItems: "center", marginBottom: 1 },
        SVEC_LOGO.split('\n').map((line, idx) => 
          React.createElement(Text, { key: idx, color: "cyan" }, line)
        )
      ),
      showSubtitle && React.createElement(Box, { marginTop: 0 },
        React.createElement(Text, { color: "gray" }, "SVEC • Simplest Video Editor CLI • v1.1.0")
      )
    ),
    
    // MASTER CONTAINER 
    React.createElement(Box, { 
      width: Math.min(size.columns - 4, 110), 
      height: Math.max(15, Math.min(26, size.rows - (showLogo ? 10 : 2))), 
      borderStyle: "round", 
      borderColor: "cyan", 
      flexDirection: "column", 
      paddingX: 1, 
      paddingY: 0,
      overflow: "hidden" 
    },
      // Top Navigation
      React.createElement(Box, { width: "100%", paddingY: 0, flexShrink: 0, justifyContent: "space-between" },
        React.createElement(Box, null,
          TABS.map((tab, index) => 
            React.createElement(Box, { key: tab, marginRight: 2 },
              React.createElement(Text, { color: activeTab === index ? 'cyan' : 'gray', bold: activeTab === index }, `[${tab}]`)
            )
          )
        ),
        React.createElement(Box, null,
          React.createElement(Text, { color: "gray", wrap: "truncate" }, `${activeTab + 1}/${TABS.length}`)
        )
      ),
      
      // Central Content Box
      React.createElement(Box, { width: "100%", flexGrow: 1, flexDirection: "column", overflow: "hidden" },
        renderActiveView()
      ),

      // Minimal Footer
      showFooter && React.createElement(Box, { 
          width: "100%",
          paddingTop: 0, 
          paddingBottom: 0,
          marginTop: 0,
          flexShrink: 0, 
          justifyContent: "space-between",
          overflow: "hidden"
        },
        React.createElement(Box, { width: "30%" },
          React.createElement(Text, { color: "gray", wrap: "truncate" }, activeTab > 0 ? "[Shift+Tab] Back" : "")
        ),
        React.createElement(Box, { flexGrow: 1, justifyContent: "flex-end" },
          React.createElement(Text, { color: "gray", wrap: "truncate" }, "[Tab/Enter] Next • [Arrows] Nav • [Ctrl+Q] Quit")
        )
      )
    )
  );
};

// Enter the alternate screen buffer explicitly for absolute safety
process.stdout.write('\x1b[?1049h');

try {
  const { waitUntilExit } = render(React.createElement(App), { exitOnCtrlC: false, enterFullscreen: true });
  
  waitUntilExit().then(() => {
    process.stdout.write('\x1b[?1049l');
    process.exit(0);
  });
} catch (e) {
  process.stdout.write('\x1b[?1049l');
  console.error(e);
}
