import copyContents from './copier';
import entryPoints from './entrypoints';

const entrypoints = await entryPoints();

await Bun.build({
  entrypoints: entrypoints,
  outdir: './build',
  minify: true,
  target: 'browser',
  naming: "[name].js",
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  sourcemap: 'none',
  format: 'esm',
});

await copyContents('./public', './build');
