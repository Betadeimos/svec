import React from 'react';
import { render, Box, Text, useInput } from 'ink';

const App = () => {
    const [msg, setMsg] = React.useState('Press something');

    useInput((input, key) => {
        setMsg(`Input: ${JSON.stringify(input)}, Hex: ${Buffer.from(input).toString('hex')}, Key: ${JSON.stringify(key)}`);
        if (input === 'q') process.exit(0);
    });

    return React.createElement(Box, { flexDirection: 'column', padding: 2 },
        React.createElement(Text, null, msg)
    );
};

render(React.createElement(App));
