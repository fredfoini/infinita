const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

let assertions = 0;
function check(condition, message) { assertions += 1; if (!condition) throw new Error(message); }
const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
function compile(relative) {
  const compiled = ts.transpileModule(read(relative), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const shim = { exports: {} }; new Function('module', 'exports', 'require', compiled)(shim, shim.exports, require); return shim.exports;
}

const matcher = compile('lib/visual/semantic-matcher.ts');
const moderation = compile('lib/visual/moderation.ts');
const descriptor = { campaignId: 'c', sceneId: 's', genre: 'western', primaryEmotion: 'luta', secondaryEmotions: ['tensão'], intensity: 'high', locationType: 'rua', environmentTags: ['poeira'], actionType: 'combate', numberOfCharacters: 3, characterArchetypes: ['pistoleiro'], importantObjects: ['revólver'], safetyClass: 'safe', visualSummary: 'confronto na rua' };
const combat = { id: 'combat', fileUrl: 'data:image/png;base64,x', provider: 'test', model: 'test', promptVersion: 'v1', createdAt: new Date().toISOString(), genreTags: ['western'], primaryEmotion: 'luta', secondaryEmotions: ['tensão'], locationTags: ['rua'], actionTags: ['combate'], environmentTags: ['poeira'], characterTags: ['pistoleiro'], intensity: 'high', safeForReuse: true, moderationStatus: 'approved', qualityScore: 1, reuseCount: 0, sceneDescriptorSnapshot: descriptor };
const romance = { ...combat, id: 'romance', primaryEmotion: 'romance', secondaryEmotions: ['afeto'], actionTags: ['conversa'] };
const match = matcher.findBestVisualAsset(descriptor, [romance, combat]);
check(match.asset.id === 'combat', 'Correspondência emocional e de ação deve superar gênero isolado.');
check(match.confidence >= .88, 'Correspondência completa deve atingir limiar de reutilização forte.');
const unsafe = moderation.moderateVisualDescriptor({ ...descriptor, visualSummary: 'violência gráfica com desmembramento' });
check(unsafe.mode === 'sanitized' && !/desmembr/i.test(unsafe.safeVisualSummary), 'Violência gráfica deve ser convertida em composição segura.');

for (const file of ['lib/visual/scene-descriptor.ts','lib/visual/image-provider.ts','lib/visual/visual-asset-repository.ts','lib/visual/visual-cycle.ts','lib/visual/sprite-system.ts','components/SceneVisual.tsx','components/LayeredWorldScene.tsx','components/PixelActor.tsx','components/ParchmentWriting.tsx','components/AdminVisualDashboard.tsx','components/Logo.tsx','public/assets/logo.png','public/assets/parchment-writing-v1.gif','public/assets/parchment-writing-source-v1.png','public/assets/hero-sprite-sheet-v1.png','public/assets/world-scene-atlas-v1.png']) check(fs.existsSync(path.join(process.cwd(), file)), `${file} deve existir.`);
check(fs.statSync(path.join(process.cwd(), 'public/assets/parchment-writing-v1.gif')).size < 2_000_000, 'GIF do pergaminho deve permanecer abaixo de 2 MB.');
const game = read('components/Game.tsx');
check(game.includes("dynamic(() => import('@/components/SceneVisual')") && game.includes('onIllustrationResolved={resolveIllustration}') && !game.includes('ProceduralScene'), 'Ciclo visual deve carregar sob demanda e persistir a ilustração.');
check(game.includes('MOCHILA') && !game.includes("setPanel('visual')") && game.includes('DIÁRIO'), 'HUD deve preservar inventário e diário sem expor controles técnicos visuais.');
const intro = read('components/IntroSequence.tsx');
check(intro.includes('<Logo variant="intro"') && intro.includes('Uma nova aventura criada por você'), 'Abertura clássica deve reutilizar o logo oficial e sua mensagem original.');
const css = read('app/globals.css');
check(css.includes('.official-logo-menu') && css.includes('.parchment-gif') && css.includes('prefers-reduced-motion'), 'Logo e pergaminho 8-bit devem ser responsivos e respeitar movimento reduzido.');
const route = read('app/api/visual/route.ts');
check(route.includes('providerUnavailable') && route.includes('retryAfterSeconds'), 'API visual deve oferecer circuit breaker ao cliente.');
check(!fs.existsSync(path.join(process.cwd(), 'lib/graphics/scene-composer.ts')), 'Scene Composer antigo deve sair do fluxo e do código morto.');
check(game.includes('<MenuSpriteStage />') && !read('components/MenuSpriteStage.tsx').includes('duelist') && read('components/MenuSpriteStage.tsx').includes('menu-fisher') && read('components/MenuSpriteStage.tsx').includes('menu-crafter'), 'Menu deve manter personagens ambientais animados sem a luta visual anterior.');
check(game.includes('className="character-portrait"') && read('components/LayeredWorldScene.tsx').includes('world-scene-atlas-v1.png') === false && read('components/LayeredWorldScene.tsx').includes('<PixelActor'), 'HUD e cena devem reutilizar a identidade visual persistida do personagem.');
check(read('components/SceneVisual.tsx').includes('COMPOSED_LOCATION_TYPES') && read('lib/visual/moderation.ts').includes('Environment only: no people'), 'Locais conhecidos devem usar composição nativa e a geração excepcional deve produzir apenas cenários compatíveis.');
check(game.includes('Escreva qualquer ação. Quando houver risco, você rolará um dado D20.'), 'Tutorial deve usar a mensagem simplificada aprovada.');
check(game.includes('<span>ENERGIA</span>') && game.includes("sendTurn('castSpell'"), 'HUD deve refletir energia persistida e conjuração real da Engine.');
check(game.includes('TESTE DE ${pendingRoll.attribute.toUpperCase()} + ${pendingRoll.skill.toUpperCase()}') && game.includes('AUDITORIA DO TESTE'), 'HUD deve explicar atributo, perícia, motivo, dificuldade e oferecer auditoria em desenvolvimento.');
check(read('components/IntroSequence.tsx').includes('elapsed / 12') && read('components/IntroSequence.tsx').includes('intro-sky') && read('components/IntroSequence.tsx').includes('PULAR'), 'Cutscene clássica de doze segundos deve ser restaurada e permitir pular.');

const gameMaster = read('lib/game-master.ts');
const turnRoute = read('app/api/turn/route.ts');
check(gameMaster.includes('context.scene.previousNarrative') && gameMaster.includes('devolva requiresDice false'), 'Consequência do D20 deve ser solicitada à IA com a cena imediatamente anterior.');
check(turnRoute.includes('stableD20') && turnRoute.includes("narration.mode !== 'ai'") && turnRoute.includes('rollPending: true'), 'Falha do provedor deve manter o D20 pendente e preservar o mesmo resultado no retry.');

const providers = read('lib/providers/provider-factory.ts');
const adapters = read('lib/providers/narrative-provider.ts');
check(providers.includes('[new GroqProvider(), new GeminiProvider(), new OpenAIProvider()]'), 'Failover textual deve respeitar Groq, Gemini e OpenAI nessa ordem.');
check(adapters.includes('GOOGLE_GENERATIVE_AI_API_KEY') && !adapters.includes('GEMINI_API_KEY') && !adapters.includes('GOOGLE_API_KEY'), 'Gemini deve usar exclusivamente GOOGLE_GENERATIVE_AI_API_KEY.');
const imageProvider = read('lib/visual/image-provider.ts');
check(imageProvider.includes("endpoint: 'https://api.openai.com/v1/images/generations'") && imageProvider.includes("provider: 'openai'"), 'Imagem deve usar exclusivamente a OpenAI antes do cache/pergaminho.');
for (const file of ['lib/skills/types.ts','lib/skills/skill-semantic-resolver.ts','lib/skills/test-selection-validator.ts','lib/skills/skill-check-engine.ts','tests/skills.test.cjs']) check(fs.existsSync(path.join(process.cwd(), file)), `${file} deve existir.`);

console.log(`INFINITA Visual: ${assertions} invariantes verificadas.`);
