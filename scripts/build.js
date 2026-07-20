#!/usr/bin/env node
/**
 * EstacionaPro — Build de producción
 * -----------------------------------
 * Minifica y empaqueta los assets estáticos hacia /dist sin tocar el
 * código fuente en CSS/ y JS/ (que sigue siendo la fuente de verdad
 * para desarrollo).
 *
 *   node scripts/build.js css   -> minifica todo CSS/**\/*.css a dist/CSS
 *   node scripts/build.js js    -> empaqueta/minifica cada entry point de JS/pages
 *   node scripts/build.js all   -> ambos
 *
 * Uso típico: "npm run build" antes de desplegar en Netlify.
 */
const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function listFiles(dir, ext) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

async function buildCSS() {
  const srcDir = path.join(ROOT, 'CSS');
  const files = listFiles(srcDir, '.css');
  for (const file of files) {
    const rel = path.relative(srcDir, file);
    const outPath = path.join(DIST, 'CSS', rel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const input = fs.readFileSync(file, 'utf8');
    const output = new CleanCSS({ level: 2 }).minify(input);
    if (output.errors.length) {
      console.error(`✗ Error minificando ${rel}:`, output.errors);
      process.exitCode = 1;
      continue;
    }
    fs.writeFileSync(outPath, output.styles);
    const before = Buffer.byteLength(input);
    const after = Buffer.byteLength(output.styles);
    console.log(`✓ CSS/${rel} → ${(before / 1024).toFixed(1)}KB → ${(after / 1024).toFixed(1)}KB`);
  }
}

async function buildJS() {
  const entryDir = path.join(ROOT, 'JS', 'pages');
  const entries = listFiles(entryDir, '.js');
  for (const entry of entries) {
    const rel = path.relative(ROOT, entry);
    const outfile = path.join(DIST, rel);
    fs.mkdirSync(path.dirname(outfile), { recursive: true });
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      minify: true,
      sourcemap: true,
      format: 'esm',
      target: ['es2019'],
      outfile,
      metafile: true,
    });
    const bytes = result.metafile.outputs[path.relative(ROOT, outfile)]?.bytes ?? 0;
    console.log(`✓ ${rel} → dist/${rel} (${(bytes / 1024).toFixed(1)}KB)`);
  }
}

(async () => {
  const target = process.argv[2] || 'all';
  fs.mkdirSync(DIST, { recursive: true });
  if (target === 'css' || target === 'all') await buildCSS();
  if (target === 'js' || target === 'all') await buildJS();
  if (target !== 'css' && target !== 'js' && target !== 'all') {
    console.error(`Objetivo desconocido: "${target}". Usa css | js | all`);
    process.exitCode = 1;
  }
})();
