// start.js
const { spawn } = require('child_process');

// Abaikan error Server is not running secara global di level proses OS
const originalEmit = process.emit;
process.emit = function (name, data, ...args) {
  if (name === 'uncaughtException' && data?.message?.includes('Server is not running')) {
    return false;
  }
  return originalEmit.apply(process, [name, data, ...args]);
};

// Jalankan Next.js start secara aman
const nextProcess = spawn('npx', ['next', 'start'], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

nextProcess.on('close', (code) => {
  process.exit(code);
});