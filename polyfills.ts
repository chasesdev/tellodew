/**
 * Polyfills for Node.js modules in React Native
 * This file must be imported before any code that uses Buffer or process
 */

import { Buffer } from 'buffer';
import process from 'process/browser';

// Make Buffer and process available globally for react-native-udp and other modules
global.Buffer = Buffer;
global.process = process;
