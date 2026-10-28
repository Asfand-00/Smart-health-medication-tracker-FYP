#!/usr/bin/env node
/**
 * Mobile project setup — `npm run setup` (also run by `npm start`).
 *
 * Idempotent and non-destructive:
 *   1. checks the Node.js and npm versions
 *   2. installs dependencies only when node_modules is missing, a declared
 *      package is missing, or package.json / package-lock.json changed since
 *      the last successful install (tracked by a hash stamp in node_modules)
 *   3. loads and validates the environment (.env / process env)
 *   4. works out the backend URL and checks whether the backend is reachable
 *
 * It never deletes files or folders. Works on Windows, macOS and Linux.
 */
'use strict';

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STAMP = path.join(ROOT, 'node_modules', '.mobile-setup-stamp');
const MIN_NODE = [20, 19, 4];
const DEFAULT_API_PORT = '5000';

const isWindows = process.platform === 'win32';
const npmCmd = 'npm';

const c = {
  ok: (m) => console.log(`\x1b[32m✔\x1b[0m ${m}`),
  info: (m) => console.log(`\x1b[36mℹ\x1b[0m ${m}`),
  warn: (m) => console.log(`\x1b[33m⚠\x1b[0m ${m}`),
  fail: (m) => console.error(`\x1b[31m✖\x1b[0m ${m}`),
  step: (m) => console.log(`\n\x1b[1m${m}\x1b[0m`),
};

class SetupError extends Error {}

function parseVersion(v) {
  return String(v).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
}

function gte(a, b) {
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
}

function run(cmd, args, opts = {}) {
  const base = { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', ...opts };
  // npm is a .cmd shim on Windows and needs a shell; pass one command string
  // (not an args array) so Node does not warn about unescaped shell arguments.
  return isWindows ? spawnSync([cmd, ...args].join(' '), { ...base, shell: true }) : spawnSync(cmd, args, base);
}

// ── 1. toolchain ────────────────────────────────────────────────────────────
function checkToolchain() {
  c.step('1/4  Checking Node.js and npm');
  const node = parseVersion(process.version);
  if (!gte(node, MIN_NODE)) {
    throw new SetupError(
      `Node.js ${process.version} is too old. Install Node.js ${MIN_NODE.join('.')} or newer (LTS 22 or 24 recommended) from https://nodejs.org`,
    );
  }
  c.ok(`Node.js ${process.version}`);

  const npm = run(npmCmd, ['--version']);
  if (npm.status !== 0 || !npm.stdout) {
    throw new SetupError('npm was not found on PATH. It ships with Node.js — reinstall Node.js from https://nodejs.org');
  }
  c.ok(`npm ${npm.stdout.trim()}`);
}

// ── 2. dependencies ─────────────────────────────────────────────────────────
function manifestHash() {
  const h = crypto.createHash('sha256');
  for (const f of ['package.json', 'package-lock.json']) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) h.update(fs.readFileSync(p));
  }
  return h.digest('hex');
}

function missingPackages() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const names = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
  return names.filter((name) => !fs.existsSync(path.join(ROOT, 'node_modules', ...name.split('/'), 'package.json')));
}

function ensureDependencies() {
  c.step('2/4  Checking dependencies');
  const hasModules = fs.existsSync(path.join(ROOT, 'node_modules'));
  const missing = hasModules ? missingPackages() : [];
  const hash = manifestHash();
  const stamp = fs.existsSync(STAMP) ? fs.readFileSync(STAMP, 'utf8').trim() : null;

  let reason = null;
  if (!hasModules) reason = 'node_modules is missing';
  else if (missing.length) reason = `missing package(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`;
  else if (stamp !== hash) reason = stamp ? 'package.json or package-lock.json changed' : 'first run of this script';

  if (!reason) {
    c.ok('All dependencies are installed and up to date');
    return;
  }

  // First run with a complete node_modules: just record the stamp.
  if (hasModules && !missing.length && !stamp) {
    fs.writeFileSync(STAMP, hash);
    c.ok('All dependencies are installed');
    return;
  }

  c.info(`Installing dependencies (${reason}) — this can take a few minutes…`);
  const result = run(npmCmd, ['install', '--no-audit', '--no-fund'], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new SetupError(
      'npm install failed. Check your internet connection and the errors above, then run `npm run setup` again.',
    );
  }
  const stillMissing = missingPackages();
  if (stillMissing.length) {
    throw new SetupError(`These packages are still missing after npm install: ${stillMissing.join(', ')}`);
  }
  fs.writeFileSync(STAMP, manifestHash());
  c.ok('Dependencies installed');
}

// ── 3. environment ──────────────────────────────────────────────────────────
function loadDotEnv() {
  const loaded = {};
  for (const file of ['.env', '.env.local']) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (!m || line.trim().startsWith('#')) continue;
      loaded[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return loaded;
}

/** First private IPv4 address — what a phone on the same Wi-Fi can reach. */
function lanAddress() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (/^(169\.254\.|127\.)/.test(a.address)) continue;
      const virtual = /vEthernet|VirtualBox|VMware|WSL|Docker|Hyper-V|Loopback|utun|tailscale|zerotier/i.test(name);
      const privateRange = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
      candidates.push({ address: a.address, score: (privateRange ? 2 : 0) + (virtual ? 0 : 1) });
    }
  }
  candidates.sort((x, y) => y.score - x.score);
  return candidates[0] ? candidates[0].address : null;
}

function checkEnvironment(args = []) {
  c.step('3/4  Checking environment configuration');
  const fileEnv = loadDotEnv();
  const env = { ...fileEnv, ...process.env };

  if (!fs.existsSync(path.join(ROOT, '.env'))) {
    c.info('No .env file — using automatic backend detection. Copy .env.example to .env to override.');
  }

  const port = env.EXPO_PUBLIC_API_PORT || DEFAULT_API_PORT;
  if (!/^\d{2,5}$/.test(port)) {
    throw new SetupError(`EXPO_PUBLIC_API_PORT must be a port number, got "${port}". Fix it in mobile/.env`);
  }

  let apiUrl = env.EXPO_PUBLIC_API_URL;
  let source = 'EXPO_PUBLIC_API_URL';
  if (apiUrl) {
    try {
      const u = new URL(apiUrl);
      if (!/^https?:$/.test(u.protocol)) throw new Error('protocol');
      if (/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) {
        c.warn(
          `EXPO_PUBLIC_API_URL points to ${u.hostname}. On a phone that is the phone itself — use this computer's LAN IP` +
            ' (e.g. http://192.168.1.20:5000) unless you are only using the iOS simulator or web.',
        );
      }
    } catch {
      throw new SetupError(
        `EXPO_PUBLIC_API_URL is not a valid http(s) URL: "${apiUrl}". Example: EXPO_PUBLIC_API_URL=http://192.168.1.20:5000`,
      );
    }
  } else {
    const ip = lanAddress();
    if (ip) {
      apiUrl = `http://${ip}:${port}`;
      source = 'detected LAN address';
    } else {
      apiUrl = `http://localhost:${port}`;
      source = 'fallback (no LAN address found)';
      c.warn('Could not find a LAN IPv4 address. A physical phone will not reach the backend — set EXPO_PUBLIC_API_URL.');
    }
    if (args.includes('--tunnel')) {
      c.warn(
        'Tunnel mode exposes Metro only, not the backend. The phone must still reach ' +
          `${apiUrl}; otherwise expose the backend yourself and set EXPO_PUBLIC_API_URL.`,
      );
    }
  }
  apiUrl = apiUrl.replace(/\/+$/, '').replace(/\/api$/, '');
  c.ok(`Backend URL: ${apiUrl}  (${source})`);
  return { apiUrl, source };
}

// ── 4. backend reachability (warning only) ─────────────────────────────────
function checkBackend(apiUrl) {
  c.step('4/4  Checking the backend');
  return new Promise((resolve) => {
    const url = `${apiUrl}/api/health`;
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 3000 }, (res) => {
      res.resume();
      if (res.statusCode === 200) c.ok(`Backend is running (${url})`);
      else c.warn(`Backend answered ${res.statusCode} at ${url}`);
      resolve(res.statusCode === 200);
    });
    const fail = (why) => {
      c.warn(`Backend not reachable at ${url} (${why}).`);
      c.info('The app will start anyway, but sign-in will fail until it is running:');
      c.info('    cd ../backend && npm install && npm run dev');
      resolve(false);
    };
    req.on('timeout', () => {
      req.destroy();
      fail('timed out');
    });
    req.on('error', (e) => fail(e.code || e.message));
  });
}

async function setup(args = []) {
  checkToolchain();
  ensureDependencies();
  const env = checkEnvironment(args);
  await checkBackend(env.apiUrl);
  return env;
}

module.exports = { setup, SetupError, c };

if (require.main === module) {
  setup(process.argv.slice(2))
    .then(() => {
      console.log('\n\x1b[32mSetup complete.\x1b[0m Run \x1b[1mnpm start\x1b[0m to launch the development server.\n');
    })
    .catch((err) => {
      c.fail(err instanceof SetupError ? err.message : err.stack || String(err));
      process.exit(1);
    });
}
