const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function compileModule(relative, customRequire = require) {
  const source = fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(moduleShim, moduleShim.exports, customRequire);
  return moduleShim.exports;
}
const memory = compileModule(path.join('lib', 'memory', 'memory-builder.ts'));
const visualCycle = compileModule(path.join('lib', 'visual', 'visual-cycle.ts'));
const engine = compileModule(path.join('lib', 'engine.ts'), id => id === '@/lib/memory/memory-builder' ? memory : id === '@/lib/visual/visual-cycle' ? visualCycle : require(id));

let assertions = 0;
function check(condition, message) { assertions += 1; if (!condition) throw new Error(message); }

const input = { campaignName: 'Teste', characterName: 'Lyra', className: 'Explorador', openingPrompt: 'Acordei sem memória dentro de um farol que flutua sobre o oceano.' };
const initial = engine.createInitialState(input);
check(initial.schemaVersion === 5, 'Estado deve usar schema v5 com memória e ciclo visual persistentes.');
check(initial.visualCycle.validActionCount === 0 && initial.visualCycle.currentPhase === 'parchment', 'Nova campanha deve começar no pergaminho, na ação zero.');
check(initial.campaign.originPrompt === input.openingPrompt, 'Origem livre deve ser persistida integralmente.');
check(initial.campaign.memory.worldGenesis.originalPrompt === input.openingPrompt, 'World Genesis deve preservar integralmente o prompt inicial.');
check(Array.isArray(initial.campaign.memory.canon) && initial.campaign.memory.anchor.themes.length > 0, 'Memória deve possuir Canon e Narrative Anchor.');
check(initial.campaign.quests.length === 0 && Object.keys(initial.world.npcs).length === 0 && Object.keys(initial.world.factions).length === 0, 'Estado-base não deve impor missão, NPC ou facção.');
check(!/norwich|mara vell|terras do vale/i.test(JSON.stringify(initial)), 'Estado-base não pode conter lore fixa residual.');
check(Object.keys(initial.character.attributes).length === 6, 'Personagem deve possuir os seis atributos.');
check(initial.character.inventory.length >= 2, 'Inventário inicial deve ser estruturado.');

const trivial = engine.beginAction(initial, 'Eu observo a luz do farol.');
check(trivial.state.character.xp === 0, 'Ação trivial não deve conceder XP.');
check(!trivial.requiresDice, 'Ação sem risco não deve pedir dado.');

const risky = engine.beginAction(trivial.state, 'Eu tento arrombar a porta sem ser visto.');
check(risky.requiresDice && risky.state.session.pendingRoll, 'Ação arriscada deve criar uma rolagem pendente.');
check(risky.roll.skill === 'Furtividade', 'A Engine deve explicar qual perícia será testada.');
const failure = engine.resolvePendingRoll(risky.state, 1);
check(!failure.result.success && failure.state.session.pendingRoll === null, 'Falha deve resolver o dado sem travar o turno.');
const continuation = engine.beginAction(failure.state, 'Eu recuo e observo outra entrada.');
check(continuation.state.session.turn === failure.state.session.turn + 1, 'A campanha deve continuar após uma falha.');

const moved = engine.beginAction(continuation.state, 'Eu sigo até a Floresta dos Sinos.');
check(engine.currentLocation(moved.state).kind === 'forest', 'Exploração deve inferir o tipo de um novo local sem lore fixa.');
check(engine.currentLocation(moved.state).name.includes('Floresta'), 'Nome declarado pelo jogador deve persistir no mapa.');

const genesis = engine.applyGenesis(initial, {
  narrative: 'O farol oscila sobre águas negras enquanto uma sirene distante canta. O que você faz?', premise: input.openingPrompt, conflict: 'O mecanismo que sustenta o farol está falhando.', origin: input.openingPrompt, profession: 'Guardião improvisado', birthRegion: 'Arquipélago Suspenso',
  initialLocation: { name: 'Farol Errante', region: 'Arquipélago Suspenso', kind: 'ruin', description: 'Uma torre antiga suspensa sobre o mar.' },
  culture: { name: 'Navegantes do Céu', values: ['reciprocidade'], customs: ['registrar tempestades'], notes: 'Comunidades vivem em ilhas suspensas.' },
  opportunities: ['Investigar o mecanismo', 'Sinalizar para uma embarcação'],
  npcs: [{ name: 'Iria', role: 'Náufraga', personality: 'Desconfiada', goal: 'Voltar para casa', profession: 'Cartógrafa' }],
  factions: [{ name: 'Liga das Velas', goal: 'Controlar as rotas aéreas' }],
  economy: { regionMultiplier: 1.2, shopName: 'Arca de Trocas', products: [{ name: 'Corda celeste', kind: 'ferramenta', basePrice: 7, stock: 2, description: 'Fibra leve e resistente.' }] }, weather: 'Ventos fortes', hour: 6,
});
check(engine.currentLocation(genesis).name === 'Farol Errante', 'Gênese deve substituir a cena neutra pela origem criada pela IA.');
check(genesis.world.culture.name === 'Navegantes do Céu' && genesis.campaign.opportunities.length === 2, 'Cultura e oportunidades iniciais devem persistir.');
check(Object.values(genesis.world.npcs)[0].status === 'active', 'NPC emergente deve nascer substituível e ativo.');
check(Object.values(genesis.world.npcs)[0].memoryProfile && engine.currentLocation(genesis).visualIdentity, 'NPC e local devem persistir continuidade narrativa e visual.');

const evolved = engine.applyNarrativeWorldDelta(genesis, { quests: [{ title: 'Manter o farol no ar', description: 'Impedir a queda.', objective: 'Estabilizar o mecanismo', status: 'active' }], worldChanges: ['Uma das correntes de sustentação se rompeu.'] });
check(evolved.campaign.quests[0].source === 'emergent', 'Objetivos devem ser marcados como emergentes.');
check(evolved.world.changes.some(change => change.includes('correntes')), 'Mudanças do mundo devem ser permanentes.');
const withoutNpc = engine.applyNarrativeWorldDelta(evolved, { npcChanges: [{ name: 'Iria', status: 'departed', memory: 'Partiu em uma embarcação.' }] });
check(Object.values(withoutNpc.world.npcs)[0].status === 'departed', 'NPC pode partir sem quebrar o estado.');
check(withoutNpc.campaign.opportunities.some(value => /rota alternativa/i.test(value)), 'Engine deve preservar uma rota alternativa quando um NPC sai de cena.');
const completed = engine.applyNarrativeWorldDelta(withoutNpc, { quests: [{ title: 'Manter o farol no ar', description: 'O mecanismo foi estabilizado.', objective: 'Estabilizar o mecanismo', status: 'completed' }] });
check(completed.character.xp > withoutNpc.character.xp, 'Objetivo emergente concluído deve conceder XP pela Engine.');

const marketState = structuredClone(genesis);
marketState.character.gold = 100;
const shop = Object.values(marketState.world.economy.shops)[0];
const purchase = engine.buyProduct(marketState, shop.id, shop.products[0].id);
check(purchase.state.character.gold < marketState.character.gold, 'Economia emergente deve continuar sob autoridade da Engine.');
check(purchase.state.character.inventory.some(item => item.name === 'Corda celeste'), 'Compra deve persistir no inventário.');

const migrated = engine.migrateState({ campaignId: 'old', campaignName: 'Antiga', characterName: 'Nox', className: 'Ladino', level: 2, xp: 100, hp: 8, maxHp: 12, gold: 3, log: ['Cena antiga'] });
check(migrated && migrated.schemaVersion === 5 && migrated.campaign.originPrompt, 'Save legado deve migrar para o paradigma emergente.');

let cycle = visualCycle.createVisualCycle('cycle-test');
for (let action = 1; action <= 10; action += 1) cycle = visualCycle.advanceVisualCycle(cycle);
check(cycle.validActionCount === 10 && cycle.currentPhase === 'parchment', 'Ações 1 a 10 devem permanecer no pergaminho.');
cycle = visualCycle.advanceVisualCycle(cycle);
check(cycle.validActionCount === 11 && cycle.currentPhase === 'illustration', 'A ação 11 deve iniciar o bloco ilustrado.');
cycle = visualCycle.attachCycleIllustration(cycle, 'asset-11', true);
for (let action = 12; action <= 20; action += 1) cycle = visualCycle.advanceVisualCycle(cycle);
check(cycle.currentPhase === 'illustration' && cycle.activeIllustrationId === 'asset-11', 'Ações 11 a 20 devem preservar exatamente a mesma ilustração.');
cycle = visualCycle.advanceVisualCycle(cycle);
check(cycle.validActionCount === 21 && cycle.currentPhase === 'parchment' && !cycle.activeIllustrationId, 'A ação 21 deve voltar ao pergaminho e encerrar o asset do bloco.');

const beforeRollCount = risky.state.visualCycle.validActionCount;
check(failure.state.visualCycle.validActionCount === beforeRollCount + 1, 'Uma rolagem concluída deve contar como ação visual válida.');

console.log(`INFINITA Engine: ${assertions} invariantes verificadas.`);
