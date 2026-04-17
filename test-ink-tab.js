import React from 'react';
import { render, Box, Text, useInput } from 'ink';

const App = () => {
    const [msg, setMsg] = React.useState('Press something');

    useInput((input, key) => {
        setMsg(JSON.stringify({ input: Buffer.from(input).toString('hex'), key }));
    });

    return (
        <Box flexDirection="column" padding={2}>
            <Text>{msg}</Text>
        </Box>
    );
};

render(<App />);
