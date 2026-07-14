import { normalizeSemanticText } from '@/lib/skills/skill-semantic-resolver';
import type { ActionDomain, ActionInterpretation, CoreAttribute, DynamicSkill, ProficiencyRank, RiskLevel, SkillResolutionAudit, ValidatedTestSelection } from '@/lib/skills/types';

type SkillDefinition = { name: string; key: string; domain: ActionDomain; primary: CoreAttribute; alternatives: CoreAttribute[]; aliases: string[]; description: string };

const DEFINITIONS: SkillDefinition[] = [
  { name: 'Luta', key: 'fighting', domain: 'combat', primary: 'strength', alternatives: ['dexterity'], aliases: ['luta', 'combate', 'combate corporal', 'luta desarmada', 'briga', 'soco', 'murro'], description: 'Combate corporal, armado ou desarmado, baseado em técnica marcial.' },
  { name: 'Armas Leves', key: 'light-weapons', domain: 'combat', primary: 'dexterity', alternatives: ['strength'], aliases: ['armas leves', 'adaga', 'punhal', 'faca', 'lamina leve'], description: 'Ataques precisos com armas pequenas e ágeis.' },
  { name: 'Corrida', key: 'running', domain: 'movement', primary: 'constitution', alternatives: ['dexterity'], aliases: ['corrida', 'correr', 'sprint', 'perseguicao a pe', 'arrancada'], description: 'Deslocamento veloz, perseguição e resistência em corrida.' },
  { name: 'Leitura', key: 'reading', domain: 'knowledge', primary: 'intelligence', alternatives: [], aliases: ['leitura', 'ler', 'decifracao textual'], description: 'Compreensão, interpretação e memorização de textos complexos.' },
  { name: 'Persuasão', key: 'persuasion', domain: 'social', primary: 'charisma', alternatives: [], aliases: ['persuasao', 'diplomacia', 'convencer', 'negociacao social'], description: 'Influência social por argumentos, negociação e confiança.' },
  { name: 'Sedução', key: 'seduction', domain: 'romance', primary: 'charisma', alternatives: [], aliases: ['seducao', 'flertar', 'flerte', 'paquera', 'romance', 'conquista'], description: 'Aproximação romântica respeitosa; nunca substitui consentimento.' },
  { name: 'Empatia', key: 'empathy', domain: 'perception', primary: 'wisdom', alternatives: ['charisma'], aliases: ['empatia', 'ler emocoes', 'perceber desconforto'], description: 'Leitura de emoções, limites e motivações de outras pessoas.' },
  { name: 'Percepção', key: 'perception', domain: 'perception', primary: 'wisdom', alternatives: [], aliases: ['percepcao', 'observar', 'notar', 'vigiar'], description: 'Detecção de sinais, perigos e detalhes pelos sentidos.' },
  { name: 'Investigação', key: 'investigation', domain: 'knowledge', primary: 'intelligence', alternatives: ['wisdom'], aliases: ['investigacao', 'investigar', 'analise', 'deducao'], description: 'Análise lógica de pistas, mecanismos e evidências.' },
  { name: 'Pesca', key: 'fishing', domain: 'survival', primary: 'wisdom', alternatives: ['dexterity'], aliases: ['pesca', 'pescar', 'pescar com vara', 'pesca com rede', 'anzol'], description: 'Localizar, atrair e capturar criaturas aquáticas.' },
  { name: 'Atletismo', key: 'athletics', domain: 'movement', primary: 'strength', alternatives: ['constitution'], aliases: ['atletismo', 'forca fisica', 'quebrar porta', 'escalar'], description: 'Aplicação de força em obstáculos, escalada e esforço atlético.' },
  { name: 'Acrobacia', key: 'acrobatics', domain: 'movement', primary: 'dexterity', alternatives: ['strength'], aliases: ['acrobacia', 'saltar', 'equilibrio', 'pular'], description: 'Saltos, equilíbrio e movimentos corporais precisos.' },
  { name: 'Ladinagem', key: 'thievery', domain: 'stealth', primary: 'dexterity', alternatives: ['intelligence'], aliases: ['ladinagem', 'arrombamento', 'arrombar', 'gazua', 'lockpick'], description: 'Manipulação de fechaduras, armadilhas e mecanismos delicados.' },
  { name: 'Furtividade', key: 'stealth', domain: 'stealth', primary: 'dexterity', alternatives: [], aliases: ['furtividade', 'esgueirar', 'infiltracao', 'sem ser visto'], description: 'Movimento e ação sem ser detectado.' },
  { name: 'Intimidação', key: 'intimidation', domain: 'social', primary: 'charisma', alternatives: ['strength'], aliases: ['intimidacao', 'ameacar', 'coagir'], description: 'Pressão social por presença, ameaça ou demonstração de força.' },
  { name: 'Sobrevivência', key: 'survival', domain: 'survival', primary: 'wisdom', alternatives: ['constitution'], aliases: ['sobrevivencia', 'rastrear', 'forragear'], description: 'Adaptação, orientação e obtenção de recursos na natureza.' },
  { name: 'Arcana', key: 'arcana', domain: 'magic', primary: 'intelligence', alternatives: ['wisdom'], aliases: ['arcana', 'magia', 'runa', 'ritual'], description: 'Conhecimento e controle de fenômenos mágicos.' },
];

export const SKILL_ATTRIBUTE_COMPATIBILITY: Record<string, CoreAttribute[]> = Object.fromEntries(DEFINITIONS.map(definition => [definition.key, [definition.primary, ...definition.alternatives]]));

export const CORE_TO_DISPLAY = { strength: 'Força', dexterity: 'Destreza', constitution: 'Constituição', intelligence: 'Inteligência', wisdom: 'Sabedoria', charisma: 'Carisma' } as const;
export const DISPLAY_TO_CORE: Record<string, CoreAttribute> = Object.fromEntries(Object.entries(CORE_TO_DISPLAY).map(([key, value]) => [normalizeSemanticText(value), key])) as Record<string, CoreAttribute>;

export function skillExperienceToNext(level: number) { return 20 + level * level * 12; }

export function proficiencyForLevel(level: number, trained = true): ProficiencyRank {
  if (!trained) return 'untrained';
  return (['novice', 'apprentice', 'competent', 'expert', 'master', 'legendary'] as ProficiencyRank[])[Math.min(5, Math.max(0, level - 1))];
}

function definitionFor(value: string, domain?: ActionDomain) {
  const normalized = normalizeSemanticText(value);
  return DEFINITIONS.find(definition => definition.key === normalized || definition.aliases.some(alias => normalizeSemanticText(alias) === normalized))
    || DEFINITIONS.find(definition => definition.domain === domain && definition.aliases.some(alias => normalized.includes(normalizeSemanticText(alias)) || normalizeSemanticText(alias).includes(normalized)));
}

export function canonicalSkill(value: string, domain?: ActionDomain) {
  const definition = definitionFor(value, domain);
  if (definition) return definition;
  const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  return { name, key: normalizeSemanticText(name).replace(/\s+/g, '-'), domain: domain || 'general', primary: 'wisdom' as CoreAttribute, alternatives: [] as CoreAttribute[], aliases: [name], description: `Capacidade treinável relacionada a ${name || 'esta ação'}.` };
}

function equivalentSkill(skills: DynamicSkill[], definition: SkillDefinition, _possibleKeys: string[]) {
  const candidates = new Set([definition.key, definition.name, ...definition.aliases].map(normalizeSemanticText));
  return skills.find(skill => candidates.has(normalizeSemanticText(skill.normalizedKey)) || candidates.has(normalizeSemanticText(skill.name)));
}

const riskDifficulty: Record<RiskLevel, number | undefined> = { none: undefined, low: 8, medium: 12, high: 15, extreme: 22 };

export function validateTestSelection(input: {
  campaignId: string;
  characterId: string;
  turnId: string;
  interpretation: ActionInterpretation;
  existingSkills: DynamicSkill[];
  llmProposal?: Partial<ActionInterpretation>;
  contextualDifficulty?: number;
  targetLabel?: string;
  targetDefense?: number;
}): ValidatedTestSelection {
  const interpretation = structuredClone(input.interpretation);
  const corrections: string[] = [];
  const proposedSkill = input.llmProposal?.proposedSkill || interpretation.proposedSkill;
  const proposedAttribute = input.llmProposal?.proposedAttribute || interpretation.proposedAttribute;
  const proposedDomain = input.llmProposal?.domain || interpretation.domain;
  const definition = canonicalSkill(proposedSkill || interpretation.proposedSkill, interpretation.domain);

  if (proposedDomain !== interpretation.domain) corrections.push(`Domínio proposto "${proposedDomain}" corrigido para "${interpretation.domain}" conforme a ação.`);
  if (proposedSkill && normalizeSemanticText(proposedSkill) !== normalizeSemanticText(definition.name)) corrections.push(`Perícia "${proposedSkill}" normalizada para "${definition.name}".`);
  const allowedAttributes = SKILL_ATTRIBUTE_COMPATIBILITY[definition.key] || [definition.primary, ...definition.alternatives];
  let attribute = proposedAttribute;
  if (!allowedAttributes.includes(attribute)) {
    corrections.push(`Atributo incompatível "${proposedAttribute}" corrigido para "${interpretation.proposedAttribute}".`);
    attribute = allowedAttributes.includes(interpretation.proposedAttribute) ? interpretation.proposedAttribute : definition.primary;
  }
  if (!allowedAttributes.includes(attribute)) attribute = definition.primary;

  const existing = equivalentSkill(input.existingSkills, definition, interpretation.possibleExistingSkillKeys);
  if (existing && normalizeSemanticText(existing.name) !== normalizeSemanticText(definition.name)) corrections.push(`Perícia equivalente reutilizada: "${existing.name}".`);
  const requiresRoll = Boolean(interpretation.requiresRoll && !interpretation.trivial && interpretation.riskLevel !== 'none');
  if (!requiresRoll && input.llmProposal?.requiresRoll) corrections.push('Rolagem sugerida foi rejeitada: não há risco, oposição e consequência suficientes.');
  const createSkill = Boolean(requiresRoll && interpretation.trainable && !existing && definition.name);
  let difficulty = requiresRoll ? (riskDifficulty[interpretation.riskLevel] || 12) : undefined;
  if (requiresRoll && input.contextualDifficulty) difficulty = Math.max(5, Math.min(30, input.contextualDifficulty));
  const opposedBy = requiresRoll && interpretation.opposed ? { label: input.targetLabel || 'oposição presente', defense: Math.max(5, Math.min(30, input.targetDefense || difficulty || 12)) } : undefined;
  if (opposedBy) difficulty = opposedBy.defense;
  const createdAt = new Date().toISOString();
  const audit: SkillResolutionAudit = {
    id: `audit-${input.turnId}-${normalizeSemanticText(interpretation.rawAction).slice(0, 18).replace(/\s/g, '-')}`,
    campaignId: input.campaignId,
    turnId: input.turnId,
    rawPlayerAction: interpretation.rawAction,
    interpretedIntent: interpretation.intent,
    domain: interpretation.domain,
    llmProposedAttribute: input.llmProposal?.proposedAttribute,
    llmProposedSkill: input.llmProposal?.proposedSkill,
    engineSelectedAttribute: attribute,
    engineSelectedSkillId: existing?.id,
    engineSelectedSkillName: existing?.name || definition.name || undefined,
    newSkillCreated: createSkill,
    corrections,
    requiresRoll,
    difficulty,
    riskLevel: interpretation.riskLevel,
    opposed: interpretation.opposed,
    reasoning: interpretation.reasoning,
    createdAt,
  };
  return {
    interpretation,
    attribute,
    skillName: existing?.name || definition.name,
    normalizedSkillKey: existing?.normalizedKey || definition.key,
    existingSkillId: existing?.id,
    createSkill,
    requiresRoll,
    difficulty,
    opposed: interpretation.opposed,
    opposedBy,
    advantage: 0,
    disadvantage: 0,
    contextualModifiers: [],
    corrections,
    audit,
  };
}

export function materializeDynamicSkill(input: { campaignId: string; characterId: string; name: string; normalizedKey: string; domain: ActionDomain; attribute: CoreAttribute; sourceAction?: string; createdDynamically?: boolean; trained?: boolean }): DynamicSkill {
  const definition = canonicalSkill(input.name, input.domain);
  const createdAt = new Date().toISOString();
  const trained = input.trained ?? true;
  return {
    id: `skill-${input.normalizedKey}-${Math.random().toString(36).slice(2, 9)}`,
    campaignId: input.campaignId,
    characterId: input.characterId,
    name: definition.name || input.name,
    normalizedKey: definition.key || input.normalizedKey,
    domain: definition.domain || input.domain,
    description: definition.description,
    primaryAttribute: input.attribute,
    alternativeAttributes: (SKILL_ATTRIBUTE_COMPATIBILITY[definition.key] || definition.alternatives).filter(attribute => attribute !== input.attribute),
    level: 1,
    experience: 0,
    experienceToNextLevel: skillExperienceToNext(1),
    proficiencyRank: proficiencyForLevel(1, trained),
    usageCount: 0,
    successCount: 0,
    failureCount: 0,
    createdDynamically: input.createdDynamically ?? true,
    sourceAction: input.sourceAction,
    specializations: [],
    createdAt,
    updatedAt: createdAt,
  };
}

export const TestSelectionValidator = { validate: validateTestSelection, canonicalSkill, materializeSkill: materializeDynamicSkill };
