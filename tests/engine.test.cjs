const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const filename = path.join(process.cwd(), 'lib', 'engine.ts');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', 'require', compiled)(moduleShim, moduleShim.exports, require);
const engine = moduleShim.exports;

let assertions = 0;
function check(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(message);
}

const initial = engine.createInitialState({ campaignName: 'Teste', characterName: 'Lyra', className: 'Explorador' });
check(initial.schemaVersion === 2, 'Estado deve usar schema v2.');
check(Object.keys(initial.character.attributes).length === 6, 'Personagem deve possuir os seis atributos.');
check(initial.character.inventory.length >= 2, 'Inventário inicial deve ser estruturado.');

const trivial = engine.beginAction(initial, 'Eu cumprimento uma pessoa na rua.');
check(trivial.state.character.xp === 0, 'Ação trivial não deve conceder XP.');
check(!trivial.requiresDice, 'Ação sem risco não deve pedir dado.');

const risky = engine.beginAction(trivial.state, 'Eu tento arrombar a porta sem ser visto.');
check(risky.requiresDice && risky.state.session.pendingRoll, 'Ação arriscada deve criar uma rolagem pendente.');
check(risky.roll.skill === 'Furtividade', 'A Engine deve explicar qual perícia será testada.');

const failure = engine.resolvePendingRoll(risky.state, 1);
check(!failure.result.success, 'Um 1 natural deve falhar.');
check(failure.state.session.pendingRoll === null, 'A falha deve encerrar a rolagem pendente.');
const continuation = engine.beginAction(failure.state, 'Eu recuo e observo outra entrada.');
check(continuation.state.session.turn === failure.state.session.turn + 1, 'A campanha deve continuar após uma falha.');

const moved = engine.beginAction(continuation.state, 'Eu sigo até a Floresta Velha.');
check(engine.currentLocation(moved.state).name === 'Floresta Velha', 'Exploração deve persistir o local atual.');
check(moved.state.world.timeline.length > 0, 'Eventos persistentes devem entrar na linha do tempo.');

const withPoint = structuredClone(moved.state);
withPoint.character.attributePoints = 1;
const improved = engine.spendAttributePoint(withPoint, 'Sabedoria');
check(improved.state.character.attributes.Sabedoria === withPoint.character.attributes.Sabedoria + 1, 'Ponto de atributo deve ser aplicado pela Engine.');
check(improved.state.character.attributePoints === 0, 'Ponto investido deve ser consumido.');

const hurt = structuredClone(improved.state);
hurt.character.hp = Math.max(1, hurt.character.maxHp - 5);
const ration = hurt.character.inventory.find(item => item.kind === 'consumível');
const used = engine.useInventoryItem(hurt, ration.id);
check(used.state.character.hp > hurt.character.hp, 'Consumível deve produzir efeito determinístico.');
check(used.state.character.inventory.find(item => item.id === ration.id).quantity === ration.quantity - 1, 'Uso deve reduzir a quantidade no inventário.');

const marketState = structuredClone(initial);
marketState.character.gold = 100;
const shop = marketState.world.economy.shops['mercado-norwich'];
const product = shop.products[0];
const purchase = engine.buyProduct(marketState, shop.id, product.id);
check(purchase.state.character.gold < marketState.character.gold, 'Compra deve descontar moedas pela Engine.');
check(purchase.state.character.inventory.some(item => item.name === product.name), 'Compra deve adicionar item ao inventário.');
check(purchase.state.world.economy.shops[shop.id].products[0].stock === product.stock - 1, 'Compra deve reduzir estoque persistente.');

const migrated = engine.migrateState({ campaignId: 'old', campaignName: 'Antiga', characterName: 'Nox', className: 'Ladino', level: 2, xp: 100, hp: 8, maxHp: 12, gold: 3, log: ['Cena antiga'] });
check(migrated && migrated.schemaVersion === 2, 'Save legado deve migrar para o schema atual.');

console.log(`INFINITA Engine: ${assertions} invariantes verificadas.`);
