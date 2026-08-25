import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = path.resolve('.');

console.log('Building Figma plugin...');

try {
  // 1. Bundle code.ts to code.js
  console.log('Bundling code.ts...');
  execSync('npx esbuild src/code.ts --bundle --platform=node --outfile=code.js', { stdio: 'inherit' });

  // 2. Bundle and minify ui.ts to a temp file
  console.log('Bundling ui.ts...');
  execSync('npx esbuild src/ui.ts --bundle --minify --outfile=ui.temp.js', { stdio: 'inherit' });

  // 3. Inject ui.temp.js into ui.html
  console.log('Injecting UI script into ui.html...');
  const htmlPath = path.join(rootDir, 'ui.html');
  const tempJsPath = path.join(rootDir, 'ui.temp.js');

  let htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const jsContent = fs.readFileSync(tempJsPath, 'utf8');

  const scriptRegex = /<script id="plugin-logic">[\s\S]*?<\/script>/;
  if (htmlContent.match(scriptRegex)) {
    htmlContent = htmlContent.replace(scriptRegex, `<script id="plugin-logic">\n${jsContent}\n</script>`);
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log('Successfully injected UI logic.');
  } else {
    console.error('Error: Could not find <script id="plugin-logic"></script> tag in ui.html!');
  }

  // 4. Clean up temp file
  fs.unlinkSync(tempJsPath);
  console.log('Build completed successfully.');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
