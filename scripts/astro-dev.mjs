import { spawn } from 'node:child_process';

const run = (args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn('npx', ['astro', ...args], { stdio: 'inherit', ...options });
  child.on('error', reject);
  child.on('exit', (code) => resolve(code ?? 1));
});

await run(['dev', '--host', '127.0.0.1']);

const logs = spawn('npx', ['astro', 'dev', 'logs', '--follow'], { stdio: 'inherit' });

const stop = async (signal) => {
  logs.kill(signal);
  await run(['astro', 'dev', 'stop']);
  process.exit(0);
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

logs.on('exit', async (code) => {
  await run(['astro', 'dev', 'stop']);
  process.exit(code ?? 0);
});
