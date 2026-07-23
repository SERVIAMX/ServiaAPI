const fs = require('fs');
const path = require('path');
const { ImageProxyService } = require('../dist/modules/image-proxy/image-proxy.service');

async function main() {
  const fakeConfig = {
    get: (k) => ({ IMAGE_PROXY_TARGET_MAX_SIDE: 512 }[k]),
  };
  const url =
    process.argv[2] ||
    'https://vwdev.movivendor.com/wsventa/resources/img/sku/COOLMF.svg';
  const res = await fetch(url);
  const raw = Buffer.from(await res.arrayBuffer());
  const before = raw.toString('utf8');
  const svc = new ImageProxyService(fakeConfig);
  const out = await svc.optimizeResponse(raw, 'image/svg+xml');
  const after = out.buffer.toString('utf8');

  const rootB = before.match(/<svg\b[^>]*>/i)[0];
  const rootA = after.match(/<svg\b[^>]*>/i)[0];
  const strip = (t) => t.replace(/data:image\/[^"']+/i, 'DATA');
  const imgB = strip(before.match(/<image\b[^>]*>/i)[0]);
  const imgA = strip(after.match(/<image\b[^>]*>/i)[0]);

  console.log('rootEqual', rootB === rootA);
  console.log('imageAttrsEqual', imgB === imgA);
  console.log('imageTag', imgA.slice(0, 220));
  console.log('hasMarker', after.includes('servia-image-proxy-optimized'));
  console.log('optimized', out.optimized);

  const dir = path.join('tmp', 'image-proxy-debug');
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, 'COOLMF-rewritten.svg');
  fs.writeFileSync(outPath, out.buffer);
  console.log('wrote', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
