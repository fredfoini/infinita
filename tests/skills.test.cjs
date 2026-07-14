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

const skillTypes = compileModule('lib/skills/types.ts');
const semantic = compileModule('lib/skills/skill-semantic-resolver.ts', id => id === '@/lib/skills/types' ? skillTypes : require(id));
const validator = compileModule('lib/skills/test-selection-validator.ts', id => id === '@/lib/skills/types' ? skillTypes : id === '@/lib/skills/skill-semantic-resolver' ? semantic : require(id));
const checks = compileModule('lib/skills/skill-check-engine.ts', id => id === '@/lib/skills/types' ? skillTypes : id === '@/lib/skills/test-selection-validator' ? validator : require(id));
const memory = compileModule('lib/memory/memory-builder.ts');
const visualCycle = compileModule('lib/visual/visual-cycle.ts');
const itemEngine = compileModule('lib/items/item-engine.ts');
const eventBus = compileModule('lib/events/event-bus.ts');
const magicEngine = compileModule('lib/magic/magic-engine.ts');
const spriteSystem = compileModule('lib/visual/sprite-system.ts');
const engine = compileModule('lib/engine.ts', id => id === '@/lib/memory/memory-builder' ? memory : id === '@/lib/visual/visual-cycle' ? visualCycle : id === '@/lib/visual/sprite-system' ? spriteSystem : id === '@/lib/items/item-engine' ? itemEngine : id === '@/lib/events/event-bus' ? eventBus : id === '@/lib/magic/magic-engine' ? magicEngine : id === '@/lib/skills/types' ? skillTypes : id === '@/lib/skills/skill-semantic-resolver' ? semantic : id === '@/lib/skills/test-selection-validator' ? validator : id === '@/lib/skills/skill-check-engine' ? checks : require(id));

let assertions = 0;
function check(condition, message) { assertions += 1; if (!condition) throw new Error(message); }
const resolve = action => semantic.resolveActionSemantics(action, { previousNarrative: 'O ferreiro guarda uma porta destrancada; um rio corre além da praça.' });

let action = resolve('Dou um soco no ferreiro.');
check(action.proposedAttribute === 'strength' && action.proposedSkill === 'Luta' && action.domain === 'combat', 'Soco deve usar Força + Luta.');
action = resolve('Ataco o ferreiro com minha adaga.');
check(action.proposedAttribute === 'dexterity' && action.proposedSkill === 'Armas Leves', 'Adaga deve usar Destreza + Armas Leves.');
action = resolve('Observo a postura do ferreiro para prever seu golpe.');
check(action.proposedAttribute === 'wisdom' && action.proposedSkill === 'Percepção', 'Observar postura deve usar Sabedoria + Percepção.');
action = resolve('Corro por muitas horas atrás da caravana.');
check(action.proposedAttribute === 'constitution' && action.proposedSkill === 'Corrida', 'Corrida longa deve usar Constituição + Corrida.');
action = resolve('Dou um sprint curto para alcançá-lo antes da esquina.');
check(action.proposedAttribute === 'dexterity' && action.proposedSkill === 'Corrida', 'Sprint curto deve usar Destreza + Corrida.');
action = resolve('Leio cuidadosamente o tratado técnico e complexo.');
check(action.proposedAttribute === 'intelligence' && action.proposedSkill === 'Leitura' && action.requiresRoll, 'Texto complexo deve usar Inteligência + Leitura.');
check(!resolve('Leio a placa simples na porta.').requiresRoll, 'Placa simples não deve exigir teste.');
action = resolve('Eu flerto com a capitã.');
check(action.proposedAttribute === 'charisma' && action.proposedSkill === 'Sedução', 'Flerte deve usar Carisma + Sedução.');
action = resolve('Examino seu rosto para perceber se ela está desconfortável.');
check(action.proposedAttribute === 'wisdom' && action.proposedSkill === 'Empatia', 'Perceber desconforto deve usar Sabedoria + Empatia.');
action = resolve('Tento beijá-la.');
check(action.consentRequired && action.proposedAttribute === 'charisma' && /consentimento/i.test(action.reasoning), 'Beijo deve preservar consentimento e usar a abordagem social correta.');
check(!resolve('Abro a porta destrancada.').requiresRoll, 'Porta destrancada não deve exigir teste.');
action = resolve('Uso uma gazua para arrombar a porta.');
check(action.proposedAttribute === 'dexterity' && action.proposedSkill === 'Ladinagem', 'Arrombamento técnico deve usar Destreza + Ladinagem.');
action = resolve('Quebro a porta com o ombro.');
check(action.proposedAttribute === 'strength' && action.proposedSkill === 'Atletismo', 'Quebrar a porta deve usar Força + Atletismo.');

const input = { campaignName: 'Perícias', characterName: 'Lyra', className: 'Exploradora', openingPrompt: 'Vivo perto de um lago perigoso.' };
const initial = engine.createInitialState(input);
check(!Object.values(initial.character.skills).some(skill => skill.name === 'Pesca'), 'Personagem deve poder iniciar sem Pesca.');
const fishingTurn = engine.beginAction(initial, 'Eu pesco com vara no lago perigoso.');
const fishing = Object.values(fishingTurn.state.character.skills).find(skill => skill.name === 'Pesca');
check(fishingTurn.requiresDice && fishing && fishing.createdDynamically, 'Primeira pescaria relevante deve criar Pesca e solicitar teste.');
const sameFishing = validator.validateTestSelection({ campaignId: initial.campaignId, characterId: initial.character.name, turnId: 'same', interpretation: resolve('Eu tento pescar com vara.'), existingSkills: [fishing] });
check(!sameFishing.createSkill && sameFishing.existingSkillId === fishing.id, 'Pescar com vara deve reutilizar Pesca.');
const trivialTurn = engine.beginAction(initial, 'Eu sento e respiro.');
check(!trivialTurn.requiresDice && Object.keys(trivialTurn.state.character.skills).length === Object.keys(initial.character.skills).length, 'Ação trivial não deve criar perícia.');

const badProposal = validator.validateTestSelection({ campaignId: initial.campaignId, characterId: initial.character.name, turnId: 'bad', interpretation: resolve('Dou um soco no ferreiro.'), existingSkills: Object.values(initial.character.skills), llmProposal: { proposedSkill: 'Luta', proposedAttribute: 'wisdom', domain: 'combat', requiresRoll: true } });
check(badProposal.attribute === 'strength' && badProposal.corrections.some(value => /incompatível/i.test(value)), 'Atributo incompatível sugerido pela LLM deve ser corrigido e auditado.');

const progressed = checks.progressDynamicSkill(fishing, fishing.experienceToNextLevel, 'success');
check(progressed.level === fishing.level + 1 && progressed.proficiencyRank === 'apprentice', 'Perícia deve evoluir após experiência significativa.');

let spam = initial;
for (let index = 0; index < 5; index += 1) {
  const turn = engine.beginAction(spam, 'Eu pesco com vara no lago perigoso.');
  spam = engine.resolvePendingRoll(turn.state, 14).state;
}
const spamFishing = Object.values(spam.character.skills).find(skill => skill.name === 'Pesca');
check(spamFishing.usageCount === 5 && spamFishing.experience <= 4, 'Spam deve registrar uso sem gerar XP infinito.');

const resolvedFishing = engine.resolvePendingRoll(fishingTurn.state, 15).state;
const reloaded = engine.migrateState(JSON.parse(JSON.stringify(resolvedFishing)));
const reloadedFishing = Object.values(reloaded.character.skills).find(skill => skill.name === 'Pesca');
check(reloadedFishing && reloadedFishing.id === fishing.id && reloadedFishing.usageCount === 1, 'E2E: Pesca deve sobreviver ao save e reload com uso persistido.');
check(reloaded.world.skillAudits.some(audit => audit.engineSelectedSkillName === 'Pesca'), 'E2E: auditoria da interpretação deve persistir.');

const legacy = structuredClone(initial);
legacy.schemaVersion = 7;
legacy.character.skills = { Corrida: { id: 'legacy-run', name: 'Corrida', attribute: 'Constituição', xp: 17, level: 2, rank: 'Aprendiz', trained: true } };
delete legacy.world.skillAudits;
delete legacy.world.skillMigrationBackup;
const migrated = engine.migrateState(legacy);
check(migrated.schemaVersion === 8 && migrated.character.skills.Corrida.experience === 17 && migrated.character.skills.Corrida.legacyImported, 'Save antigo deve migrar perícia sem perder progressão.');
check(migrated.world.skillMigrationBackup.length === 1, 'Migração deve preservar backup da perícia original.');

console.log(`INFINITA Skills: ${assertions} cenários verificados.`);
