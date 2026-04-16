import fs from 'fs';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Simplified Babel registration for Node.js ESM
// In newer Node.js versions, we can use a loader or just use the @babel/register
// with some tweaks. For this environment, we'll try a different approach:
// Use a simple runner script.

import '@babel/register';
import './ui.jsx';
