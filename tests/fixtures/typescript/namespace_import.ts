// Fixture for testing namespace import, default import, export re-export, and side-effect import.
// Covers tree-sitter grammar nodes: namespace_import, export_clause, identifier (default import).

import * as fs from 'node:fs';
import * as path from 'node:path';
import defaultValue from './basic';
import './side-effect-module';

export * from './basic';
export { UserId } from './basic';

export function useFs(p: string): boolean {
  return fs.existsSync(p);
}

export function usePath(p: string): string {
  return path.dirname(p);
}

export const def = defaultValue;
