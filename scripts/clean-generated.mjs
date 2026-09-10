import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(root, 'src', '__generated__');
if (dirname(target) !== resolve(root, 'src')) throw new Error('Invalid generated path');
rmSync(target, { recursive: true, force: true });