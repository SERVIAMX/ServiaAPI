const sharp = require('sharp');
const { createHash } = require('crypto');
const path = require('path');

// Load compiled service if possible; otherwise inline same logic
async function main() {
  const url =
    process.argv[2] ||
    'https://vwdev.movivendor.com/wsventa/resources/img/sku/COOLMF.svg';

  const res = await fetch(url, {
    headers: { 'User-Agent': 'ServiaAPI-ImageProxy/1.1' },
  });
  console.log('upstream', res.status, res.headers.get('content-type'));
  const raw = Buffer.from(await res.arrayBuffer());
  console.log('upstreamBytes', raw.length);

  const svg = raw.toString('utf8');
  const re =
    /data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\r\n\t ]+)/gi;
  const matches = [...svg.matchAll(re)];
  console.log('embedsFound', matches.length);
  console.log('hasXlinkHref', /xlink:href\s*=/i.test(svg));
  console.log('hasHrefAttr', /\shref\s*=/i.test(svg));

  const imgIdx = svg.search(/<image[\s>]/i);
  console.log('imageTagSample', svg.slice(Math.max(0, imgIdx), Math.max(0, imgIdx) + 180));

  for (let i = 0; i < matches.length; i++) {
    const mime = matches[i][1];
    const b64 = matches[i][2].replace(/\s+/g, '');
    const decoded = Buffer.from(b64, 'base64');
    const meta = await sharp(decoded, {
      failOn: 'none',
      limitInputPixels: 50_000_000,
    }).metadata();
    console.log('BEFORE', {
      i,
      mime,
      width: meta.width,
      height: meta.height,
      bytes: decoded.length,
    });
  }

  // Run through ImageProxyService from dist
  const { ImageProxyService } = require('../dist/modules/image-proxy/image-proxy.service');
  const fakeConfig = {
    get: (key) => {
      const map = {
        IMAGE_PROXY_TRIGGER_MAX_WIDTH: 4000,
        IMAGE_PROXY_TRIGGER_MAX_HEIGHT: 4000,
        IMAGE_PROXY_TRIGGER_MAX_UNCOMPRESSED_MB: 20,
        IMAGE_PROXY_TARGET_MAX_SIDE: 512,
      };
      return map[key];
    },
  };
  const svc = new ImageProxyService(fakeConfig);
  const out = await svc.optimizeResponse(raw, 'image/svg+xml');
  console.log('optimizedFlag', out.optimized);
  console.log('outBytes', out.buffer.length, 'contentType', out.contentType);

  const outSvg = out.buffer.toString('utf8');
  const outMatches = [...outSvg.matchAll(re)];
  console.log('embedsAfter', outMatches.length);

  for (let i = 0; i < outMatches.length; i++) {
    const mime = outMatches[i][1];
    const b64 = outMatches[i][2].replace(/\s+/g, '');
    const decoded = Buffer.from(b64, 'base64');
    const meta = await sharp(decoded, {
      failOn: 'none',
      limitInputPixels: 50_000_000,
    }).metadata();
    const before = matches[i]
      ? Buffer.from(matches[i][2].replace(/\s+/g, ''), 'base64')
      : null;
    const beforeHash = before
      ? createHash('sha1').update(before).digest('hex')
      : null;
    const afterHash = createHash('sha1').update(decoded).digest('hex');
    console.log('AFTER', {
      i,
      mime,
      width: meta.width,
      height: meta.height,
      bytes: decoded.length,
      base64Replaced: beforeHash !== afterHash,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
