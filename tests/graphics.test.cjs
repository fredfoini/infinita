const fs = require('node:fs');
const path = require('node:path');

let assertions = 0;
function check(condition, message) { assertions += 1; if (!condition) throw new Error(message); }
const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const bible = JSON.parse(read('public/assets/sprite_bible.json'));
check(bible.version === 1, 'Sprite Bible deve ser versionada.');
check(bible.assets.length >= 4, 'Todos os assets existentes devem ser catalogados.');
check(bible.assets.every(asset => asset.id && asset.category && asset.size.width > 0 && asset.layers.length), 'Cada asset deve possuir contrato completo.');
check(bible.assets.some(asset => asset.id === 'characters.npc.atlas.transparent'), 'Atlas transparente de NPCs deve estar registrado.');
check(bible.assets.some(asset => asset.id === 'background.settlement.square.01'), 'Fundo de assentamento deve estar registrado.');
check(bible.visualStandard.forbidden.includes('runtime-ai-generation'), 'Geração de imagens durante gameplay deve estar proibida.');

for (const file of ['lib/graphics/asset-registry.ts','lib/graphics/scene-composer.ts','lib/graphics/character-composer.ts','lib/graphics/building-composer.ts','lib/graphics/renderer.ts']) check(fs.existsSync(path.join(process.cwd(), file)), `${file} deve existir.`);

const intro = read('components/IntroSequence.tsx');
check(intro.includes('Uma nova aventura criada por você'), 'A mensagem final da abertura deve existir.');
check(intro.includes('PULAR') && intro.includes('COMEÇAR JORNADA'), 'A abertura deve ser ignorável e possuir CTA final.');
const game = read('components/Game.tsx');
for (const label of ['MOCHILA','MAPA','MISSÕES','FICHA','DIÁRIO']) check(game.includes(label), `Menu ${label} deve existir.`);
check(game.includes('className="action-form"'), 'A barra de ação deve possuir contrato visual próprio.');
const css = read('app/globals.css');
check(css.includes('.action-form{position:fixed'), 'A ação deve ficar fixa em celulares.');
check(css.includes('aside.drawer-open'), 'Os painéis móveis devem ser recolhíveis.');
check(css.includes('@keyframes portalOpen'), 'A abertura deve animar o portal em sprites/CSS leve.');

console.log(`INFINITA Graphics: ${assertions} invariantes verificadas.`);
