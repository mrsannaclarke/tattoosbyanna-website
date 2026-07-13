import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

const frontendUrl = 'http://127.0.0.1:4321';
const bridgeHost = '127.0.0.1';
const bridgePort = 8787;
const configPath = join(homedir(), '.config', 'stripe', 'config.toml');

const config = await readFile(configPath, 'utf8').catch(() => '');
const key = config.match(/^test_mode_api_key\s*=\s*['"]([^'"]+)['"]\s*$/m)?.[1];

if (!key) {
  console.error('No Stripe CLI test credential was found. Run `stripe login` and try again.');
  process.exit(1);
}

process.env.STRIPE_RESTRICTED_KEY = key;
process.env.URL = frontendUrl;

// Import after setting the environment so the Stripe client receives the local test key.
const { handler } = await import('../netlify/functions/create-checkout-session.mjs');

const bridge = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);

  const headers = Object.fromEntries(
    Object.entries(request.headers).map(([name, value]) => [name.toLowerCase(), Array.isArray(value) ? value.join(', ') : value ?? '']),
  );

  try {
    const result = await handler({
      httpMethod: request.method,
      headers,
      body: Buffer.concat(chunks).toString('utf8'),
    });

    response.writeHead(result.statusCode, result.headers);
    response.end(result.body);
  } catch (error) {
    console.error('Local Stripe bridge error:', error);
    response.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    response.end(JSON.stringify({ error: 'The local payment service encountered an error.' }));
  }
});

bridge.listen(bridgePort, bridgeHost, () => {
  console.log(`Local Stripe bridge ready at http://${bridgeHost}:${bridgePort}`);
  console.log(`Website ready at ${frontendUrl}`);
});

const frontend = spawn(process.execPath, ['scripts/astro-dev.mjs'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
});

let stopping = false;
const stop = (signal = 'SIGTERM') => {
  if (stopping) return;
  stopping = true;
  bridge.close();
  frontend.kill(signal);
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

frontend.on('exit', (code) => {
  bridge.close(() => process.exit(code ?? 0));
});
