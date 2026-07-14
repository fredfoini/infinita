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
const sharingPolicy = compile('lib/content-sharing-policy.ts');
const narrativeCleaner = compile('lib/narrative-cleaner.ts');
const descriptor = { campaignId: 'c', sceneId: 's', genre: 'western', primaryEmotion: 'luta', secondaryEmotions: ['tensão'], intensity: 'high', locationType: 'rua', environmentTags: ['poeira'], actionType: 'combate', numberOfCharacters: 3, characterArchetypes: ['pistoleiro'], importantObjects: ['revólver'], safetyClass: 'safe', visualSummary: 'confronto na rua' };
const combat = { id: 'combat', fileUrl: 'data:image/png;base64,x', provider: 'test', model: 'test', promptVersion: 'v1', createdAt: new Date().toISOString(), genreTags: ['western'], primaryEmotion: 'luta', secondaryEmotions: ['tensão'], locationTags: ['rua'], actionTags: ['combate'], environmentTags: ['poeira'], characterTags: ['pistoleiro'], intensity: 'high', safeForReuse: true, moderationStatus: 'approved', qualityScore: 1, reuseCount: 0, sceneDescriptorSnapshot: descriptor };
const romance = { ...combat, id: 'romance', primaryEmotion: 'romance', secondaryEmotions: ['afeto'], actionTags: ['conversa'] };
const match = matcher.findBestVisualAsset(descriptor, [romance, combat]);
check(match.asset.id === 'combat', 'Correspondência emocional e de ação deve superar gênero isolado.');
check(match.confidence >= .88, 'Correspondência completa deve atingir limiar de reutilização forte.');
const unsafe = moderation.moderateVisualDescriptor({ ...descriptor, visualSummary: 'violência gráfica com desmembramento' });
check(unsafe.mode === 'sanitized' && !/desmembr/i.test(unsafe.safeVisualSummary), 'Violência gráfica deve ser convertida em composição segura.');
check(sharingPolicy.classifyGlobalContribution('Quero tornar o mundo em ruínas e servi-lo ao mestre do mal').mode === 'local-only', 'Campanha extrema deve deixar de contribuir para o banco global.');
check(sharingPolicy.classifyGlobalContribution('Exploro uma ruína e converso com o guarda').mode === 'global', 'Aventura comum deve continuar elegível para contribuição global.');
check(narrativeCleaner.cleanNarrativeScaffolding('Kain executa: “Eu exploro o local”. Uma passagem se abre.', 'Kain') === 'Uma passagem se abre.', 'Scaffolding legado deve ser removido inclusive de saves já existentes.');

for (const file of ['lib/visual/scene-descriptor.ts','lib/visual/image-provider.ts','lib/visual/visual-asset-repository.ts','lib/visual/global-visual-registry.ts','lib/visual/visual-cycle.ts','lib/visual/sprite-system.ts','app/api/visual-library/route.ts','app/api/visual/evolve/route.ts','app/portable.css','components/PortableGameHeader.tsx','components/ConsequencesLog.tsx','components/SceneVisual.tsx','components/LayeredWorldScene.tsx','components/PixelActor.tsx','components/ItemIcon.tsx','components/ParchmentWriting.tsx','components/AdminVisualDashboard.tsx','components/Logo.tsx','public/assets/logo.png','public/assets/parchment-writing-v1.gif','public/assets/parchment-writing-source-v1.png','public/assets/hero-sprite-sheet-v1.png','public/assets/world-scene-atlas-v1.png','public/assets/intro-scene-atlas-v2.png','public/assets/item-icon-atlas-v1.png']) check(fs.existsSync(path.join(process.cwd(), file)), `${file} deve existir.`);
check(fs.statSync(path.join(process.cwd(), 'public/assets/parchment-writing-v1.gif')).size < 2_000_000, 'GIF do pergaminho deve permanecer abaixo de 2 MB.');
check(!read('components/ParchmentWriting.tsx').includes('A CRÔNICA CONTINUA') && !read('components/ParchmentWriting.tsx').includes('parchment-caption'), 'Pergaminho não deve sobrepor uma legenda ao nome do local.');
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
check(game.includes('className="character-portrait"'), 'HUD deve reutilizar a identidade visual persistida do personagem.');
const sceneVisual = read('components/SceneVisual.tsx');
check(sceneVisual.includes('<ParchmentWriting') && sceneVisual.includes('<Image className="scene-illustration"') && !sceneVisual.includes('<LayeredWorldScene'), 'Cena deve mostrar pergaminho por padrão e somente a ilustração contextual quando ela existir, sem sobrepor sprites.');
check(read('components/SceneVisual.tsx').includes('parentAssetId') && read('lib/visual/moderation.ts').includes("player's latest intent is the dominant creative direction"), 'Novos cenários devem derivar do banco global e priorizar a ação escrita pelo jogador.');
check(game.includes('Escreva qualquer ação. Quando houver risco, você rolará um dado D20.'), 'Tutorial deve usar a mensagem simplificada aprovada.');
check(game.includes('<span>ENERGIA</span>') && game.includes("sendTurn('castSpell'"), 'HUD deve refletir energia persistida e conjuração real da Engine.');
check(game.includes('TESTE DE ${pendingRoll.attribute.toUpperCase()} + ${pendingRoll.skill.toUpperCase()}') && game.includes('AUDITORIA DO TESTE'), 'HUD deve explicar atributo, perícia, motivo, dificuldade e oferecer auditoria em desenvolvimento.');
check(read('components/IntroSequence.tsx').includes('elapsed / 12') && read('components/IntroSequence.tsx').includes('intro-sky') && read('components/IntroSequence.tsx').includes('PULAR'), 'Cutscene clássica de doze segundos deve ser restaurada e permitir pular.');
check(read('components/IntroSequence.tsx').includes('intro-pixel-sequence') && css.includes('intro-scene-atlas-v2.png'), 'Cutscene deve usar cenários integralmente em pixel art, sem montanhas vetoriais.');
check(read('components/InventoryPanel.tsx').includes('<ItemIcon item={item} campaignId={campaignId}') && read('components/ItemIcon.tsx').includes('/api/visual/evolve') && css.includes('item-icon-atlas-v1.png'), 'Inventário deve usar o atlas original e evoluir globalmente ícones ainda desconhecidos.');
check(read('lib/items/item-engine.ts').includes('suggestions.slice(0, 12)') && !read('lib/items/item-engine.ts').includes('if (!validEffects.length) return null'), 'Engine deve registrar múltiplos itens por turno e completar efeitos ausentes.');
check(read('lib/visual/global-visual-registry.ts').includes('parentAssetId') === false && read('lib/visual/image-provider.ts').includes('parentAssetId') && read('lib/visual/types.ts').includes('lineageGeneration'), 'Assets devem registrar pai, raiz e geração de linhagem.');
check(read('components/LayeredWorldScene.tsx').includes("kind: 'motion-sheet'") && read('lib/visual/sprite-system.ts').includes("'custom'"), 'Ações novas do jogador devem poder criar movimentos incrementais persistidos globalmente.');
check(!game.includes('setAppearanceDescription') && game.includes('VISUAL SORTEADO'), 'Menu não deve solicitar uma aparência que o sprite não reproduzirá; o visual deve ser sorteado.');
const portableCss = read('app/portable.css');
check(portableCss.includes('width:min(100%,680px)') && portableCss.includes('.game-screen .grid,.game-screen .adventure{display:contents}'), 'Desktop deve preservar a pilha mobile dentro de um container portátil central.');
check(portableCss.includes('--ui-space-1:4px') && portableCss.includes('--ui-space-6:24px') && read('app/layout.tsx').includes("import './portable.css'"), 'Design System portátil deve usar tokens compartilhados e ser carregado após o legado.');
check(game.includes('<PortableGameHeader') && game.includes('<ConsequencesLog') && read('components/ConsequencesLog.tsx').includes('event.priority >= 55'), 'Header e consequências devem ser componentes reutilizáveis, mantendo apenas eventos importantes.');
check(portableCss.includes('.portable-header .header-status{display:flex;flex:1 1 auto') && portableCss.includes('.portable-header .campaign-clock{display:block;flex:1 1 auto') && !portableCss.includes('.campaign-clock{max-width:170px'), 'Cabeçalho desktop deve reservar espaço flexível para campanha, nível, dia e hora sem corte prematuro.');

const gameMaster = read('lib/game-master.ts');
const turnRoute = read('app/api/turn/route.ts');
check(gameMaster.includes('context.scene.previousNarrative') && gameMaster.includes('devolva requiresDice false'), 'Consequência do D20 deve ser solicitada à IA com a cena imediatamente anterior.');
check(turnRoute.includes('stableD20') && turnRoute.includes("narration.mode !== 'ai'") && turnRoute.includes('rollPending: true'), 'Falha do provedor deve manter o D20 pendente e preservar o mesmo resultado no retry.');
check(turnRoute.includes('actionPreserved: true') && game.includes('setAction(playerAction)'), 'Falha narrativa em uma ação comum deve preservar estado e texto para retry.');
check(!gameMaster.includes('A rotina de') && !gameMaster.includes('proceduralReaction'), 'Fallback genérico não pode aparecer como se fosse uma reação narrativa real.');
check(!gameMaster.includes('${state.character.name} executa:') && gameMaster.includes('cleanNarrativeScaffolding') && gameMaster.includes('Comece diretamente pela reação concreta do mundo'), 'Narração deve remover a repetição da ação e começar pela consequência.');
check(gameMaster.includes('TODOS os objetos adquiridos') && gameMaster.includes('inferConfirmedStoredItems') && !gameMaster.includes('Use no máximo um item por turno'), 'Contrato narrativo deve sincronizar todo loot confirmado e recuperar itens explicitamente guardados.');
check(read('app/api/visual/evolve/route.ts').includes('localOnly') && read('lib/visual/global-visual-registry.ts').includes("contribution.mode === 'local-only'"), 'Conteúdo restrito deve permanecer local e nunca entrar no banco visual global.');

const providers = read('lib/providers/provider-factory.ts');
const adapters = read('lib/providers/narrative-provider.ts');
check(providers.includes('[new GroqProvider(), new GeminiProvider(), new OpenAIProvider()]'), 'Failover textual deve respeitar Groq, Gemini e OpenAI nessa ordem.');
check(adapters.includes('GOOGLE_GENERATIVE_AI_API_KEY') && !adapters.includes('GEMINI_API_KEY') && !adapters.includes('GOOGLE_API_KEY'), 'Gemini deve usar exclusivamente GOOGLE_GENERATIVE_AI_API_KEY.');
const imageProvider = read('lib/visual/image-provider.ts');
check(
  imageProvider.includes("generationEndpoint: 'https://api.openai.com/v1/images/generations'") &&
    imageProvider.includes("editEndpoint: 'https://api.openai.com/v1/images/edits'") &&
    imageProvider.includes("provider: 'openai'"),
  'Imagem deve usar a OpenAI para geração e derivação visual antes do cache/pergaminho.',
);
for (const file of ['lib/skills/types.ts','lib/skills/skill-semantic-resolver.ts','lib/skills/test-selection-validator.ts','lib/skills/skill-check-engine.ts','tests/skills.test.cjs']) check(fs.existsSync(path.join(process.cwd(), file)), `${file} deve existir.`);
check(imageProvider.includes("IMAGE_SCENE_QUALITY || 'high'") && imageProvider.includes('.resize(1536, 864') && imageProvider.includes('infinita-scene-hd-v2') && sceneVisual.includes('HD_SCENE_PROMPT_VERSION') && css.includes('image-rendering:auto'), 'Ilustrações de cena devem usar qualidade alta, proporção portátil e redimensionamento nítido, sem reutilizar cache antigo de baixa definição.');
check(game.includes('className="narrative-copy"') && portableCss.includes('overflow-wrap:break-word') && !portableCss.includes('.game-screen .narrative:after'), 'Narrativa desktop deve quebrar linhas dentro da moldura sem sobreposição do pseudo-elemento.');

console.log(`INFINITA Visual: ${assertions} invariantes verificadas.`);
