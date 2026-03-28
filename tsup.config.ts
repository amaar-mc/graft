import { copyFile, mkdir } from 'fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/cli/index.ts' },
  format: ['cjs'],
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: false,
  outExtension: () => ({ js: '.cjs' }),
  async onSuccess() {
    // Copy WASM files needed at runtime for web-tree-sitter and grammars
    await mkdir('dist', { recursive: true });

    const wasmFiles = [
      [
        'node_modules/web-tree-sitter/web-tree-sitter.wasm',
        'dist/web-tree-sitter.wasm',
      ],
      [
        'node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm',
        'dist/tree-sitter-typescript.wasm',
      ],
      [
        'node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm',
        'dist/tree-sitter-tsx.wasm',
      ],
      [
        'node_modules/tree-sitter-javascript/tree-sitter-javascript.wasm',
        'dist/tree-sitter-javascript.wasm',
      ],
      [
        'node_modules/tree-sitter-python/tree-sitter-python.wasm',
        'dist/tree-sitter-python.wasm',
      ],
    ];

    for (const [src, dest] of wasmFiles) {
      await copyFile(src, dest);
    }
  },
});
