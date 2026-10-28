#!/usr/bin/env node
/**
 * `npm start` — prepare (see setup.js) and launch the Expo dev server.
 *
 * Extra arguments are passed to `expo start`, e.g.
 *   npm start -- --android     open on a connected device / emulator
 *   npm start -- --clear       clear the Metro cache
 *   npm run start:tunnel       phone on a different network
 *
 * The resolved backend URL is passed to the app as EXPO_PUBLIC_API_URL so a
 * phone on the same Wi-Fi reaches the backend without a .env file.
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const { setup, SetupError, c } = require('./setup');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

setup(args)
  .then(({ apiUrl }) => {
    console.log('\n\x1b[1mStarting Expo…\x1b[0m  Scan the QR code with Expo Go (Android) or the Camera app (iOS).\n');
    const options = { cwd: ROOT, stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl } };
    // npx is a .cmd shim on Windows: run it through the shell as one command string.
    const child =
      process.platform === 'win32'
        ? spawn(['npx', 'expo', 'start', ...args].join(' '), { ...options, shell: true })
        : spawn('npx', ['expo', 'start', ...args], options);
    const forward = (sig) => () => child.kill(sig);
    process.on('SIGINT', forward('SIGINT'));
    process.on('SIGTERM', forward('SIGTERM'));
    child.on('exit', (code) => process.exit(code ?? 0));
  })
  .catch((err) => {
    c.fail(err instanceof SetupError ? err.message : err.stack || String(err));
    process.exit(1);
  });
