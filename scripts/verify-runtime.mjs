import fs from 'node:fs/promises';
const base = process.env.VERIFY_API_ORIGIN || 'http://127.0.0.1:3000';
const health = await fetch(`${base}/api/health`).then(r => r.json());
if (!health.ok) throw new Error('Backend health failed');
const config = await fetch(`${base}/api/stencil-config`).then(r => r.json());
console.log('Runtime capabilities:', JSON.stringify(config.capabilities));
if (!config.capabilities.configured) throw new Error('Image service runtime is not configured');
const response = await fetch(`${base}/api/stencils`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept: 'a lotus flower', style: 'fine_line', medium: 'blackwork', clientId: 'inkflow-runtime-validation', requestId: `live-check-${Date.now()}` }) });
const created = await response.json();
if (response.status !== 202) throw new Error(`Create failed: ${JSON.stringify(created)}`);
await fs.mkdir('.cache', { recursive: true });
await fs.writeFile('.cache/runtime-check.json', JSON.stringify(created));
console.log('Real generation job created:', created.id);
const deadline = Date.now() + 8 * 60 * 1000;
let last = '';
while (Date.now() < deadline) {
  const result = await fetch(`${base}/api/stencils/${created.id}?token=${encodeURIComponent(created.token)}`).then(r => r.json());
  const state = `${result.status} ${result.progress} ${result.stage}`;
  if (last !== state) { console.log(state); last = state; }
  if (result.status === 'failed') throw new Error(result.error || 'Pipeline failed');
  if (result.status === 'ready') {
    if (result.options.length !== 4 || result.options.some(o => !o.mirrored)) throw new Error('Invalid option count or mirroring');
    const asset = await fetch(`${base}${result.options[0].pngUrl}`);
    if (!asset.ok) throw new Error(`PNG asset unavailable: ${asset.status}`);
    const bytes = Buffer.from(await asset.arrayBuffer());
    await fs.writeFile('.cache/runtime-stencil.png', bytes);
    await fs.writeFile('.cache/runtime-result.json', JSON.stringify(result));
    const sharp = (await import('sharp')).default;
    const { data } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (data.some(v => v !== 0 && v !== 255)) throw new Error('Stencil contains nonbinary pixels');
    console.log('Verified: 4 real variants, full-resolution mirrored PNG, pure black/white output, storage readback.', result.options[0].width, result.options[0].height);
    process.exit(0);
  }
  await new Promise(r => setTimeout(r, 4000));
}
throw new Error('Generation is still pending after the smoke-check deadline. Do not automatically generate another request.');
