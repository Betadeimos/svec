import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
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
        <Text color="gray">[Tab] Next • [Enter] Select • [Ctrl+Q] Quit</Text>
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

const App = () => {
    const [activeTab, setActiveTab] = useState(0);
    const { exit } = useApp();

    useInput((input, key) => {
        if (input === 'q' && key.ctrl) {
            exit();
        }
        if (key.tab) {
            if (key.shift) {
                setActiveTab(prev => Math.max(0, prev - 1));
            } else {
                setActiveTab(prev => Math.min(4, prev + 1));
            }
        }
    });

    return (
        <Box flexDirection="column" width={80} borderStyle="double" borderColor="gray" padding={1}>
            <Header />
            <Tabs activeTab={activeTab} />
            <Box height={18} borderStyle="single" borderTop={false} borderColor="gray">
                {activeTab === 0 && <FilesScreen />}
            </Box>
            <Footer currentStep={activeTab} totalSteps={5} />
        </Box>
    );
};

render(<App />);
