/**
 * Parses a time string (e.g. 1m 20s, 10s, or 00:00:10) into FFmpeg-compatible seconds or time format.
 * @param {string} input 
 * @returns {string}
 */
export function parseTime(input) {
    if (!input || input.trim() === '') return '0';
    input = input.trim().toLowerCase();
    if (input.includes(':')) return input;
    let seconds = 0;
    let matched = false;
    const hMatch = input.match(/([\d.]+)h/);
    const mMatch = input.match(/([\d.]+)m/);
    const sMatch = input.match(/([\d.]+)s/);
    if (hMatch) { seconds += parseFloat(hMatch[1]) * 3600; matched = true; }
    if (mMatch) { seconds += parseFloat(mMatch[1]) * 60; matched = true; }
    if (sMatch) { seconds += parseFloat(sMatch[1]); matched = true; }
    if (!matched && !isNaN(parseFloat(input))) { seconds = parseFloat(input); matched = true; }
    return matched ? seconds.toString() : input;
}
