'use strict';
// Development: runs the API (Express on 127.0.0.1:PORT) and the Vite dev
// server (127.0.0.1:5173, proxies /api) together. No extra dependencies.
require('dotenv').config({ quiet: true });
const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const procs = [
  spawn(process.execPath, ['--watch-path=src', '--watch-path=server.js', 'server.js'], { cwd: root, stdio: 'inherit', env: process.env }),
  spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], { cwd: path.join(root, 'web'), stdio: 'inherit', env: process.env, shell: process.platform === 'win32' }),
];
console.log('\nHQ Desk dev: open http://127.0.0.1:5173 (API on 127.0.0.1:%s)\n', process.env.PORT || 4317);
const stop = () => { for (const p of procs) p.kill('SIGTERM'); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => { if (code) { console.error('A dev process exited; stopping.'); stop(); } });
