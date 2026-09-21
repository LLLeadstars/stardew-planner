import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const coreDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'core');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('领域核心的纯函数边界', () => {
  it('核心源文件不引用 window / document / localStorage', () => {
    const forbidden = ['window', 'document', 'localStorage'];
    const offenders: string[] = [];
    for (const file of sourceFiles(coreDir)) {
      const source = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        if (new RegExp(`\\b${token}\\b`).test(source)) {
          offenders.push(`${file}: ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
