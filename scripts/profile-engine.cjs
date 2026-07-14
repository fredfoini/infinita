const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { performance } = require('node:perf_hooks');

function compile(relative, customRequire = require) {
  const source = fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', output)(shim, shim.exports, customRequire);
  return shim.exports;
}
const memory = compile('lib/memory/memory-builder.ts');
const visual = compile('lib/visual/visual-cycle.ts');
const items = compile('lib/items/item-engine.ts');
const events = compile('lib/events/event-bus.ts');
const magic = compile('lib/magic/magic-engine.ts');
const engine = compile('lib/engine.ts', id => id === '@/lib/memory/memory-builder' ? memory : id === '@/lib/visual/visual-cycle' ? visual : id === '@/lib/items/item-engine' ? items : id === '@/lib/events/event-bus' ? events : id === '@/lib/magic/magic-engine' ? magic : require(id));

let state = engine.createInitialState({ campaignName: 'Perfil', characterName: 'Ari', className: 'Explorador', openingPrompt: 'Uma cartógrafa registra ilhas que mudam de lugar.' });
for (let turn = 0; turn < 80; turn += 1) state = engine.acceptNarrative(engine.beginAction(state, `Observo cuidadosamente o horizonte no ciclo ${turn}.`).state, `A observação ${turn} revela uma mudança sutil. O que você faz?`);

function benchmark(label, iterations, fn) {
  const started = performance.now();
  for (let index = 0; index < iterations; index += 1) fn();
  const elapsed = performance.now() - started;
  return { label, iterations, totalMs: +elapsed.toFixed(2), averageMs: +(elapsed / iterations).toFixed(4) };
}

const stateJson = JSON.stringify(state);
const contextJson = JSON.stringify(engine.buildAiContext(state));
const results = [
  benchmark('migrateState', 250, () => engine.migrateState(JSON.parse(stateJson))),
  benchmark('buildAiContext (cached)', 2000, () => engine.buildAiContext(state)),
  benchmark('serialize save', 500, () => JSON.stringify(state)),
  benchmark('serialize LLM context', 1000, () => JSON.stringify(engine.buildAiContext(state))),
];
console.log(JSON.stringify({ stateBytes: stateJson.length, llmContextBytes: contextJson.length, contextReductionPercent: +(100 - contextJson.length / stateJson.length * 100).toFixed(1), results }, null, 2));
