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
const itemEngine = compileModule(path.join('lib', 'items', 'item-engine.ts'));
const eventBus = compileModule(path.join('lib', 'events', 'event-bus.ts'));
const magicEngine = compileModule(path.join('lib', 'magic', 'magic-engine.ts'));
const engine = compileModule(path.join('lib', 'engine.ts'), id => id === '@/lib/memory/memory-builder' ? memory : id === '@/lib/visual/visual-cycle' ? visualCycle : id === '@/lib/items/item-engine' ? itemEngine : id === '@/lib/events/event-bus' ? eventBus : id === '@/lib/magic/magic-engine' ? magicEngine : require(id));

let assertions = 0;
function check(condition, message) { assertions += 1; if (!condition) throw new Error(message); }

const input = { campaignName: 'Teste', characterName: 'Lyra', className: 'Explorador', openingPrompt: 'Acordei sem memória dentro de um farol que flutua sobre o oceano.' };
const initial = engine.createInitialState(input);
check(initial.schemaVersion === 7, 'Estado deve usar schema v7 transacional.');
check(initial.character.mana <= initial.character.maxMana && initial.character.energy <= initial.character.maxEnergy, 'Recursos devem nascer dentro dos limites persistidos.');
check(Array.isArray(initial.character.spells) && Array.isArray(initial.world.processedTurnIds), 'Magic Engine e idempotência devem existir no estado.');
check(initial.visualCycle.validActionCount === 0 && initial.visualCycle.currentPhase === 'parchment', 'Nova campanha deve começar no pergaminho, na ação zero.');
check(initial.campaign.originPrompt === input.openingPrompt, 'Origem livre deve ser persistida integralmente.');
check(initial.campaign.memory.worldGenesis.originalPrompt === input.openingPrompt, 'World Genesis deve preservar integralmente o prompt inicial.');
check(Array.isArray(initial.campaign.memory.canon) && initial.campaign.memory.anchor.themes.length > 0, 'Memória deve possuir Canon e Narrative Anchor.');
check(initial.campaign.quests.length === 0 && Object.keys(initial.world.npcs).length === 0 && Object.keys(initial.world.factions).length === 0, 'Estado-base não deve impor missão, NPC ou facção.');
check(!/norwich|mara vell|terras do vale/i.test(JSON.stringify(initial)), 'Estado-base não pode conter lore fixa residual.');
check(Object.keys(initial.character.attributes).length === 6, 'Personagem deve possuir os seis atributos.');
check(initial.character.inventory.length >= 2, 'Inventário inicial deve ser estruturado.');
check(initial.character.inventory.every(item => item.effects.mechanical.length && item.history.length && item.ownerId), 'Todo item deve possuir efeito real, proprietário e histórico.');

const trivial = engine.beginAction(initial, 'Eu observo a luz do farol.');
check(trivial.state.character.xp === 0, 'Ação trivial não deve conceder XP.');
check(!trivial.requiresDice, 'Ação sem risco não deve pedir dado.');
const conjugatedRisk = engine.beginAction(initial, 'Eu salto sobre o abismo.');
check(conjugatedRisk.requiresDice && conjugatedRisk.roll.skill === 'Acrobacia', 'Detector deve reconhecer flexões comuns e o contexto de perigo.');

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
check(migrated && migrated.schemaVersion === 7 && migrated.campaign.originPrompt, 'Save legado deve migrar para o paradigma emergente.');

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

const procedural = engine.applyNarrativeWorldDelta(initial, { items: [{ name: 'Vara de Maré', description: 'Uma vara artesanal adaptada ao oceano suspenso.', category: 'tool', rarity: 'uncommon', weight: 1.2, value: 18, quantity: 1, origin: 'Encontrada no depósito do farol.', narrativeEffects: ['Permite alcançar cardumes entre as nuvens.'], mechanicalEffects: [{ type: 'unlock_action', target: 'pescar entre as nuvens', value: 1 }], durability: 24 }] }, 'Lyra encontra a Vara de Maré no depósito e decide carregá-la.');
const generatedItem = procedural.character.inventory.find(item => item.name === 'Vara de Maré');
check(generatedItem && procedural.world.itemRegistry[generatedItem.id], 'Item sugerido pela IA deve ser validado e persistido no registro mundial.');
const usedTool = engine.performItemAction(procedural, { action: 'use', itemId: generatedItem.id });
check(usedTool.state.character.unlockedActions.includes('pescar entre as nuvens'), 'Ferramenta deve desbloquear uma ação mecânica real.');
const soldTool = engine.performItemAction(procedural, { action: 'sell', itemId: generatedItem.id });
check(soldTool.state.character.gold > procedural.character.gold && !soldTool.state.character.inventory.some(item => item.id === generatedItem.id), 'Jogador deve conseguir vender um item com impacto econômico permanente.');
const destroyedTool = engine.performItemAction(procedural, { action: 'destroy', itemId: generatedItem.id });
check(!destroyedTool.state.character.inventory.some(item => item.id === generatedItem.id) && destroyedTool.state.world.itemRegistry[generatedItem.id].state === 'destroyed', 'Item destruído deve sair do inventário e permanecer no histórico do mundo.');
const lostInitial = engine.performItemAction(initial, { action: 'lose', itemId: initial.character.inventory[1].id });
check(lostInitial.state.world.itemRegistry[initial.character.inventory[1].id].state === 'lost', 'Jogador deve conseguir perder itens permanentemente.');

const legacyV5 = structuredClone(initial); legacyV5.schemaVersion = 5; legacyV5.character.inventory = [{ id: 'legacy-item', name: 'Objeto antigo', kind: 'material', quantity: 1, value: 2, description: 'Veio de um save anterior.' }]; delete legacyV5.world.itemRegistry; delete legacyV5.world.unlocks; delete legacyV5.character.unlockedActions;
const migratedV5 = engine.migrateState(legacyV5);
check(migratedV5.schemaVersion === 7 && migratedV5.character.inventory[0].effects.mechanical.length, 'Save v5 deve ganhar o novo contrato sem perder o inventário antigo.');

const synchronized = engine.applyNarrativeWorldDelta(initial, {
  locations: [{ name: 'Oficina Suspensa', region: 'Arquipélago', kind: 'workshop', description: 'Uma oficina presa a balões.' }], currentLocationName: 'Oficina Suspensa',
  spells: [{ name: 'Faísca do Farol', fantasy: 'Uma centelha concentrada atinge um oponente.', suggestedType: 'attack', suggestedPower: 'low', origin: 'Treino com o mecanismo do farol.' }],
  mechanicalEffects: [{ type: 'damage_player', amount: 3, reason: 'Estilhaços do mecanismo.' }],
}, 'Lyra aprende Faísca do Farol na Oficina Suspensa, mas sofre com os estilhaços.');
check(engine.currentLocation(synchronized).name === 'Oficina Suspensa' && engine.currentLocation(synchronized).kind === 'workshop', 'Mapa deve aceitar e persistir tipos de local emergentes.');
check(synchronized.character.hp === initial.character.hp - 3, 'Dano sugerido deve ser validado e aplicado pela Engine.');
check(synchronized.world.timeline.some(event => event.eventType === 'DamageApplied'), 'Dano deve produzir evento tipado.');
check(synchronized.character.spells.length === 1, 'Magia sugerida deve ser normalizada e aprendida pela Engine.');

const beforeCastMana = synchronized.character.mana;
const cast = engine.performSpellCast(synchronized, synchronized.character.spells[0].id);
check(cast.state.character.mana === beforeCastMana - cast.state.character.spells[0].manaCost, 'Magia deve gastar mana atomicamente.');
check(cast.state.character.mana >= 0, 'Mana nunca pode ficar negativa.');
check(cast.state.session.combat && cast.state.session.combat.enemyHp < cast.state.session.combat.enemyMaxHp, 'Magia ofensiva deve causar dano persistido no alvo.');
let cooldownBlocked = false;
try { engine.performSpellCast(cast.state, cast.state.character.spells[0].id); } catch (error) { cooldownBlocked = /recarga/i.test(error.message); }
check(cooldownBlocked, 'Cooldown deve impedir reutilização imediata.');
const noMana = structuredClone(synchronized); noMana.character.mana = 0;
let manaBlocked = false;
try { engine.performSpellCast(noMana, noMana.character.spells[0].id); } catch (error) { manaBlocked = /mana insuficiente/i.test(error.message); }
check(manaBlocked && noMana.character.mana === 0, 'Magia sem mana deve falhar sem alterar o estado.');

const manaPotionState = structuredClone(cast.state);
manaPotionState.character.mana = 0;
const potion = itemEngine.normalizeItem({ name: 'Tônico de Bruma', description: 'Restaura mana.', category: 'consumable', quantity: 1, effects: { narrative: [], mechanical: [{ type: 'restore_mana', value: 6 }] } }, manaPotionState.character.name, 'Teste');
manaPotionState.character.inventory.push(potion); manaPotionState.world.itemRegistry[potion.id] = structuredClone(potion);
const drank = engine.performItemAction(manaPotionState, { action: 'use', itemId: potion.id });
check(drank.state.character.mana === Math.min(6, drank.state.character.maxMana), 'Poção deve recuperar mana respeitando o máximo.');
check(!drank.state.character.inventory.some(item => item.id === potion.id), 'Poção consumida deve sair do inventário.');
check(drank.state.world.timeline.some(event => event.eventType === 'ManaRestored'), 'Recuperação de mana deve emitir evento tipado.');

const hpCap = engine.applyNarrativeWorldDelta(initial, { mechanicalEffects: [{ type: 'heal_player', amount: 999, reason: 'Fonte restauradora.' }] }, 'Lyra toca a fonte restauradora.');
check(hpCap.character.hp === hpCap.character.maxHp, 'Cura não pode ultrapassar HP máximo.');

const attackState = structuredClone(risky.state); const attackMana = attackState.character.mana;
const basicAttack = engine.resolvePendingRoll(attackState, 20);
check(basicAttack.state.character.mana === attackMana, 'Ataque básico não deve consumir mana.');

const idempotentBase = engine.beginAction(initial, 'Eu examino o mecanismo.', 'turn-fixed-id');
const committedIdempotent = engine.acceptNarrative(idempotentBase.state, 'O mecanismo revela uma engrenagem solta. O que você faz?');
const repeated = engine.beginAction(committedIdempotent, 'Eu examino o mecanismo.', 'turn-fixed-id');
check(repeated.state.session.turn === committedIdempotent.session.turn && repeated.events.length === 0, 'Retry com mesmo ID não pode duplicar efeitos.');

const reloaded = engine.migrateState(JSON.parse(JSON.stringify(drank.state)));
check(reloaded.character.mana === drank.state.character.mana && reloaded.character.spells.length === drank.state.character.spells.length, 'Save/reload deve preservar mana, magias e estado mecânico.');

const stateBytes = JSON.stringify(procedural).length;
const contextBytes = JSON.stringify(engine.buildAiContext(procedural)).length;
check(contextBytes < stateBytes * .65, 'Contexto enviado ao LLM deve ser significativamente menor que o save completo.');

console.log(`INFINITA Engine: ${assertions} invariantes verificadas.`);
