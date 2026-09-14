import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

// Expand test paths ourselves so the same command works in Windows and Unix.
const files = readdirSync(new URL('../tests/', import.meta.url))
  .filter(name => name.endsWith('.test.mjs')).sort().map(name => 'tests/' + name);
const result = spawnSync(process.execPath, ['--test', ...files], {stdio: 'inherit'});
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
