const fs = require('node:fs');
const path = require('node:path');

const assetsDir = path.join(process.cwd(), 'public', 'assets');
const output = path.join(assetsDir, 'sprite_bible.json');
const metadata = {
  'npc-atlas-transparent.png': { id: 'characters.npc.atlas.transparent', category: 'characters', tags: ['npc','humanoid','fantasy','gba','transparent'], layers: ['character'], variants: 32, animations: ['idle-2-frame'], compatibility: ['scene:*','genre:fantasy'] },
  'npc-atlas-v1.png': { id: 'characters.npc.atlas.source', category: 'source', tags: ['npc','atlas','source'], layers: ['source'], variants: 32, animations: [], compatibility: ['tooling'] },
  'tile-prop-atlas-v1.png': { id: 'tiles.props.atlas.01', category: 'tiles-and-props', tags: ['building','furniture','nature','road','fantasy','gba'], layers: ['background','midground','foreground'], variants: 64, animations: [], compatibility: ['scene:*','genre:fantasy'] },
  'village-square-bg-v1.png': { id: 'background.settlement.square.01', category: 'background', tags: ['settlement','village','city','road','fantasy','gba'], layers: ['background'], variants: 1, animations: [], compatibility: ['scene:settlement','scene:city','genre:fantasy'] },
};

function dimensions(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file} não é PNG.`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const assets = fs.readdirSync(assetsDir).filter(file => file.endsWith('.png')).sort().map(file => {
  const meta = metadata[file] || { id: `uncatalogued.${path.parse(file).name}`, category: 'uncatalogued', tags: [], layers: ['midground'], variants: 1, animations: [], compatibility: [] };
  return { ...meta, file: `/assets/${file}`, size: dimensions(path.join(assetsDir, file)), pixelArt: true };
});
const bible = { version: 1, generatedAt: new Date().toISOString(), visualStandard: { era: '16-bit handheld', nativeScene: { width: 320, height: 180 }, scaling: 'nearest-neighbor', forbidden: ['realistic','3d','runtime-ai-generation'] }, assets };
fs.writeFileSync(output, `${JSON.stringify(bible, null, 2)}\n`);
console.log(`Sprite Bible: ${assets.length} assets catalogados.`);
