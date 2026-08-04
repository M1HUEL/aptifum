import fs from 'node:fs';
import path from 'node:path';

export function resolveWorkspaceRoot(start: string = process.cwd()): string {
  let dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('Could not locate workspace root (pnpm-workspace.yaml)');
    }
    dir = parent;
  }
}
