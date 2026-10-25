// 사용법: npm run build  (docs/ 폴더에 배포용 파일이 만들어져요)
//        npm run watch  (파일을 고칠 때마다 자동으로 다시 빌드)
import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');
mkdirSync('docs', { recursive: true });

function copyStatic() {
  copyFileSync('index.html', 'docs/index.html');
  copyFileSync('src/style.css', 'docs/style.css');
  copyFileSync('favicon.png', 'docs/favicon.png');
}

const options = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  outfile: 'docs/app.js',
  loader: { '.json': 'json' },
  minify: !watch,
  sourcemap: watch,
  target: ['es2020'],
  logLevel: 'info',
};

copyStatic();
if (watch) {
  const { watch: fsWatch } = await import('node:fs');
  ['index.html', 'src/style.css', 'favicon.png'].forEach((f) => fsWatch(f, copyStatic));
  const ctx = await esbuild.context({
    ...options,
    plugins: [{ name: 'copy-static', setup(b) { b.onEnd(copyStatic); } }],
  });
  await ctx.watch();
  console.log('watching… (Ctrl+C to stop)');
} else {
  await esbuild.build(options);
}