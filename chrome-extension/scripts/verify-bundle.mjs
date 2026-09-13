import { readFile } from 'node:fs/promises';

const bundle = await readFile(new URL('../dist/floating-panel.js', import.meta.url), 'utf8');

const forbiddenGlobals = [
  { name: 'process.env', pattern: /\bprocess\.env\b/u },
  { name: 'require()', pattern: /\brequire\s*\(/u }
];

const remaining = forbiddenGlobals.filter(({ pattern }) => pattern.test(bundle));
if (remaining.length > 0) {
  throw new Error(`Browser bundle contains Node-only globals: ${remaining.map(({ name }) => name).join(', ')}`);
}

console.log('Floating panel bundle contains no Node-only globals.');
