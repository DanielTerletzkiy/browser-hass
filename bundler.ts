import copyContents from './copier';
import entryPoints from './entrypoints';
import { copyFileSync } from 'fs';

const browserTarget = process.argv[2] || 'chrome';

const entrypoints = await entryPoints();

await Bun.build({
  entrypoints: entrypoints,
  outdir: `./build/${browserTarget}`,
  minify: true,
  target: 'browser',
  naming: '[name].js',
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  sourcemap: 'none',
  format: 'esm',
});

await copyContents('./public', `./build/${browserTarget}`);

// Copy the appropriate manifest file
const sourceManifest = browserTarget === 'firefox'
  ? './public/manifest.firefox.json'
  : './public/manifest.json';
const destManifest = `./build/${browserTarget}/manifest.json`;

copyFileSync(sourceManifest, destManifest);
console.log(`Built for ${browserTarget} browser`);
