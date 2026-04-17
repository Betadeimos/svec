import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { spawn } from 'child_process';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import fs from 'fs';
import path from 'path';

const SVEC_LOGO = `███████╗██╗   ██╗███████╗ ██████╗
██╔════╝██║   ██║██╔════╝██╔════╝
███████╗██║   ██║█████╗  ██║     
╚════██║╚██╗ ██╔╝██╔══╝  ██║     
███████║ ╚████╔╝ ███████╗╚██████╗
╚══════╝  ╚═══╝  ╚══════╝ ╚═════╝`;

const PRIMARY_COLOR = '#00DFFF';

const Header = () => (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Text color={PRIMARY_COLOR}>{SVEC_LOGO}</Text>
        <Box marginTop={1}>
            <Text color="gray">SVEC • Simplest Video Editor CLI • v1.0.9</Text>
        </Box>
    </Box>
);

const Tabs = ({ activeTab }) => {
    const tabs = ['Files', 'Trim', 'Resize', 'Format', 'Export'];
    return (
        <Box borderStyle="single" borderBottom={false} borderColor="gray">
            {tabs.map((tab, idx) => {
                const isActive = idx === activeTab;
                return (
                    <Box key={tab} flexGrow={1} justifyContent="center" paddingX={1} 
                         borderStyle={isActive ? 'single' : undefined} 
                         borderColor={isActive ? PRIMARY_COLOR : 'gray'}
                         borderTop={false} borderLeft={false} borderRight={false}>
                        <Text color={isActive ? PRIMARY_COLOR : 'gray'}>
                            {idx + 1}. {tab}
                        </Text>
                    </Box>
                );
            })}
        </Box>
    );
};

const Footer = ({ currentStep, totalSteps }) => (
    <Box borderStyle="single" borderColor="gray" borderTop={true} paddingX={1} justifyContent="space-between">
        <Text color="gray">{currentStep > 0 ? '[Shift+Tab] Back' : ''}</Text>
        <Text color="gray">{currentStep + 1}/{totalSteps}</Text>
        <Text color="gray">[Tab] Next • [Enter] Select • [Ctrl+R] Reload • [Ctrl+Q] Quit</Text>
    </Box>
);

const FilesScreen = () => {
    const [query, setQuery] = useState('');
    const [files, setFiles] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [activeField, setActiveField] = useState(0); // 0: Search, 1: File List

    useEffect(() => {
        const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v'];
        const list = fs.readdirSync(process.cwd())
            .filter(f => videoExts.includes(path.extname(f).toLowerCase()))
            .map(f => {
                try {
                    const stats = fs.statSync(f);
                    return {
                        label: f,
                        value: f,
                        size: (stats.size / (1024 * 1024)).toFixed(1) + ' MB'
                    };
                } catch (e) {
                    return null;
                }
            })
            .filter(Boolean);
        setFiles(list);
    }, []);

    const filteredFiles = files.filter(f => f.label.toLowerCase().includes(query.toLowerCase()));
    
    // Bounds check for selectedIndex
    useEffect(() => {
        if (selectedIndex >= filteredFiles.length && filteredFiles.length > 0) {
            setSelectedIndex(filteredFiles.length - 1);
        }
    }, [filteredFiles.length, selectedIndex]);

    const selectedFile = filteredFiles[selectedIndex];

    useInput((input, key) => {
        if (activeField === 1) {
            if (key.upArrow) {
                setSelectedIndex(prev => Math.max(0, prev - 1));
            }
            if (key.downArrow) {
                setSelectedIndex(prev => Math.min(filteredFiles.length - 1, prev + 1));
            }
        }
        if (key.return) {
            if (activeField === 0) setActiveField(1);
        }
    });

    return (
        <Box flexDirection="column" paddingX={1} height={15}>
            <Box borderStyle="single" borderColor={activeField === 0 ? PRIMARY_COLOR : 'gray'} paddingX={1} marginBottom={1}>
                <Text color={PRIMARY_COLOR}>{'> '} </Text>
                <TextInput 
                    value={query} 
                    onChange={(v) => { setQuery(v); setSelectedIndex(0); }} 
                    placeholder="search files..."
                    focus={activeField === 0}
                />
            </Box>

            <Box flexGrow={1}>
                <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={activeField === 1 ? PRIMARY_COLOR : 'gray'}>
                    <Box borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderColor="gray" paddingX={1}>
                        <Text color="gray" flexGrow={1}>NAME</Text>
                        <Text color="gray">SIZE</Text>
                    </Box>
                    <Box flexDirection="column" paddingX={1}>
                        {filteredFiles.slice(0, 8).map((f, idx) => (
                            <Box key={f.value}>
                                <Text color={idx === selectedIndex && activeField === 1 ? PRIMARY_COLOR : 'white'}>
                                    {idx === selectedIndex && activeField === 1 ? '> ' : '  '}
                                    {f.label.length > 30 ? f.label.slice(0, 27) + '...' : f.label.padEnd(30)} {f.size}
                                </Text>
                            </Box>
                        ))}
                        {filteredFiles.length === 0 && <Text color="gray">No files found.</Text>}
                    </Box>
                </Box>

                <Box width={25} flexDirection="column" borderStyle="single" borderColor="gray" marginLeft={1}>
                    <Box borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderColor="gray" paddingX={1}>
                        <Text color="gray">INFO</Text>
                    </Box>
                    <Box flexDirection="column" paddingX={1}>
                        {selectedFile ? (
                            <>
                                <Text color="white" wrap="truncate-end">File: {selectedFile.label}</Text>
                                <Text color="white">Size: {selectedFile.size}</Text>
                                <Text color="gray" marginTop={1}>[Enter] to select</Text>
                            </>
                        ) : (
                            <Text color="gray">No selection</Text>
                        )}
                    </Box>
                </Box>
            </Box>

            <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
                <Text color="gray">Output: </Text>
                <Text color={PRIMARY_COLOR}>[x] Same as input</Text>
                <Text color="gray">  [ ] Custom path...</Text>
            </Box>
        </Box>
    );
};

const TrimScreen = ({ file }) => {
    const defaultDuration = file && file.duration ? file.duration : '05:30';
    const [trimStart, setTrimStart] = useState('00:00');
    const [trimEnd, setTrimEnd] = useState(defaultDuration);
    const [activeField, setActiveField] = useState(0); // 0: Start, 1: End

    // Update trim end when file changes
    useEffect(() => {
        if (file) {
            setTrimEnd(file.duration || '05:30');
            setTrimStart('00:00');
        }
    }, [file]);

    const parseTimeToSeconds = (timeStr) => {
        if (!timeStr) return 0;
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 3) {
            return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
        } else if (parts.length === 2) {
            return (parts[0] || 0) * 60 + (parts[1] || 0);
        }
        return parts[0] || 0;
    };

    const formatSecondsToTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        if (h > 0) {
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const totalSeconds = parseTimeToSeconds(defaultDuration) || 1;
    const startSeconds = parseTimeToSeconds(trimStart);
    const endSeconds = parseTimeToSeconds(trimEnd);
    const startPct = Math.max(0, Math.min(100, (startSeconds / totalSeconds) * 100));
    const endPct = Math.max(0, Math.min(100, (endSeconds / totalSeconds) * 100));
    const barWidth = 60;

    // Draw timeline bar
    const renderTimelineBar = () => {
        const elements = [];
        for (let i = 0; i < barWidth; i++) {
            const pct = (i / barWidth) * 100;
            if (pct >= startPct && pct < endPct) {
                elements.push(<Text key={i} color="white">█</Text>);
            } else {
                elements.push(<Text key={i} color="white" dim>█</Text>);
            }
        }
        return elements;
    };

    useInput((input, key) => {
        if (key.upArrow || key.downArrow) {
            setActiveField(prev => prev === 0 ? 1 : 0);
        }
        if (key.leftArrow || key.rightArrow) {
            const delta = key.leftArrow ? -1 : 1;
            if (activeField === 0) {
                const newStart = Math.max(0, Math.min(startSeconds + delta, endSeconds - 1));
                setTrimStart(formatSecondsToTime(newStart));
            } else {
                const newEnd = Math.max(startSeconds + 1, Math.min(endSeconds + delta, totalSeconds));
                setTrimEnd(formatSecondsToTime(newEnd));
            }
        }
    });

    return (
        <Box flexDirection="column" paddingX={2} flexGrow={1}>
            <Box flexGrow={1} />
            
            <Box flexDirection="column" alignItems="center">
                <Box justifyContent="center" marginBottom={0}>
                    <Text color="gray">File: </Text>
                    <Text color="white">{file ? file.label : 'None'}</Text>
                    <Text color="gray"> ({defaultDuration})</Text>
                </Box>

                <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={2} paddingY={0}>
                    <Box justifyContent="space-between">
                        <Text color="gray">00:00</Text>
                        <Text color="gray">{defaultDuration}</Text>
                    </Box>
                    <Box justifyContent="center" marginY={0}>
                        <Text wrap="truncate">{renderTimelineBar()}</Text>
                    </Box>
                    <Box justifyContent="space-between">
                        <Text color={activeField === 0 ? PRIMARY_COLOR : 'gray'} bold={activeField === 0}>{trimStart}</Text>
                        <Text color={activeField === 1 ? PRIMARY_COLOR : 'gray'} bold={activeField === 1}>{trimEnd}</Text>
                    </Box>
                </Box>

                <Box justifyContent="center" marginTop={0} marginBottom={1}>
                    <Text color="gray">Selection: {Math.max(0, Math.round(endPct - startPct))}%</Text>
                </Box>

                <Box justifyContent="center" gap={6}>
                    <Box flexDirection="column" alignItems="center">
                        <Text color={activeField === 0 ? PRIMARY_COLOR : 'gray'}>Start Time</Text>
                        <Box borderStyle="single" borderColor={activeField === 0 ? PRIMARY_COLOR : 'gray'} paddingX={1}>
                            <Text color="white" bold={activeField === 0}>{trimStart}</Text>
                        </Box>
                    </Box>
                    <Box flexDirection="column" alignItems="center">
                        <Text color={activeField === 1 ? PRIMARY_COLOR : 'gray'}>End Time</Text>
                        <Box borderStyle="single" borderColor={activeField === 1 ? PRIMARY_COLOR : 'gray'} paddingX={1}>
                            <Text color="white" bold={activeField === 1}>{trimEnd}</Text>
                        </Box>
                    </Box>
                </Box>
            </Box>

            <Box flexGrow={1} />

            <Box justifyContent="center">
                <Text color="gray" dim>[↑/↓] Toggle • [←/→] Adjust time</Text>
            </Box>
        </Box>
    );
};

const App = () => {
    const [activeTab, setActiveTab] = useState(0);
    const { exit } = useApp();

    useInput((input, key) => {
        if (input === 'q' && key.ctrl) {
            exit();
        }
        if (input === 'r' && key.ctrl) {
            spawn(process.argv[0], process.argv.slice(1), { stdio: 'inherit' });
            exit();
        }

        const isShiftTab = (key.shift && key.tab) || input === '\u001b[Z';
        const isTab = key.tab || input === '\t';

        if (isShiftTab) {
            setActiveTab(prev => (prev === 0 ? 4 : prev - 1));
        } else if (isTab) {
            setActiveTab(prev => (prev === 4 ? 0 : prev + 1));
        }
    });

    return (
        <Box flexDirection="column" width={80} borderStyle="double" borderColor="gray" padding={1}>
            <Header />
            <Tabs activeTab={activeTab} />
            <Box height={18} borderStyle="single" borderTop={false} borderColor="gray">
                {activeTab === 0 && <FilesScreen />}
                {activeTab === 1 && <TrimScreen file={null} />}
                {activeTab >= 2 && (
                    <Box flexGrow={1} alignItems="center" justifyContent="center">
                        <Text color="gray">Screen {activeTab + 1} Mockup</Text>
                    </Box>
                )}
            </Box>
            <Footer currentStep={activeTab} totalSteps={5} />
        </Box>
    );
};

render(<App />);
