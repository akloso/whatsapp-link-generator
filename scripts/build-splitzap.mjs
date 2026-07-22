import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, 'tools', 'splitzap-source.html');
const publicHtmlPath = path.join(repoRoot, 'public', 'splitzap-app.html');
const assetDir = path.join(repoRoot, 'public', 'splitzap-assets');
const chunkSize = 7500;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readChunkFiles() {
  if (!fs.existsSync(assetDir)) {
    throw new Error('Missing public/splitzap-assets directory.');
  }

  const files = fs
    .readdirSync(assetDir)
    .filter((file) => /^chunk-\d+\.js$/.test(file))
    .sort();

  if (!files.length) {
    throw new Error('No Splitzap chunk files found.');
  }

  return files.map((file) => {
    const content = fs.readFileSync(path.join(assetDir, file), 'utf8');
    const match = content.match(/window\.__splitzapChunks\[\d+\]='([^']*)';/);
    if (!match) {
      throw new Error(`Invalid Splitzap chunk format: ${file}`);
    }
    return match[1];
  });
}

function extractSource() {
  const chunks = readChunkFiles();
  const html = Buffer.from(chunks.join(''), 'base64').toString('utf8');

  ensureDir(path.dirname(sourcePath));
  fs.writeFileSync(sourcePath, html, 'utf8');

  console.log(`Created ${path.relative(repoRoot, sourcePath)}`);
}

function cleanOldChunks() {
  ensureDir(assetDir);
  for (const file of fs.readdirSync(assetDir)) {
    if (/^chunk-\d+\.js$/.test(file)) {
      fs.unlinkSync(path.join(assetDir, file));
    }
  }
}

function buildSplitzap() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Missing tools/splitzap-source.html. Run: npm run splitzap:extract');
  }

  const sourceHtml = fs.readFileSync(sourcePath, 'utf8');
  const base64 = Buffer.from(sourceHtml, 'utf8').toString('base64');
  const chunks = [];

  for (let i = 0; i < base64.length; i += chunkSize) {
    chunks.push(base64.slice(i, i + chunkSize));
  }

  cleanOldChunks();

  chunks.forEach((chunk, index) => {
    const chunkName = `chunk-${String(index).padStart(2, '0')}.js`;
    const chunkContent = `window.__splitzapChunks=window.__splitzapChunks||[];window.__splitzapChunks[${index}]='${chunk}';\n`;
    fs.writeFileSync(path.join(assetDir, chunkName), chunkContent, 'utf8');
  });

  const loaderHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Splitzap</title>
</head>
<body>
${chunks.map((_, index) => `  <script src="/splitzap-assets/chunk-${String(index).padStart(2, '0')}.js"></script>`).join('\n')}
  <script>
    function decodeBase64Utf8(base64) {
      var binary = atob(base64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    }

    var splitzapHtml = (window.__splitzapChunks || [])
      .map(function (chunk) { return decodeBase64Utf8(chunk); })
      .join('');

    document.open();
    document.write(splitzapHtml);
    document.close();
  </script>
</body>
</html>
`;

  fs.writeFileSync(publicHtmlPath, loaderHtml, 'utf8');

  console.log(`Built Splitzap: ${chunks.length} chunks`);
  console.log(`Updated ${path.relative(repoRoot, publicHtmlPath)}`);
  console.log(`Updated ${path.relative(repoRoot, assetDir)}`);
}

if (process.argv.includes('--extract')) {
  extractSource();
} else {
  buildSplitzap();
}
