import { build } from 'esbuild';
import { copyFile, mkdir, chmod, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
await mkdir(resolve(root, 'dist'), { recursive: true });
await build({
  entryPoints: ['gmail', 'sidebar', 'worker'].map((name) =>
    resolve(root, `src/${name}.ts`),
  ),
  bundle: true,
  outdir: resolve(root, 'dist'),
  format: 'esm',
  target: 'chrome116',
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
});
for (const name of ['manifest.json', 'sidebar.html', 'sidebar.css'])
  await copyFile(resolve(root, name), resolve(root, 'dist', name));
try {
  await access(resolve(root, 'local-config.json'));
  await copyFile(
    resolve(root, 'local-config.json'),
    resolve(root, 'dist/local-config.json'),
  );
  await chmod(resolve(root, 'dist/local-config.json'), 0o600);
} catch {
  await copyFile(
    resolve(root, 'local-config.example.json'),
    resolve(root, 'dist/local-config.json'),
  );
}
console.log(`Load unpacked extension from ${resolve(root, 'dist')}`);
