import { skillExperienceToNext, proficiencyForLevel } from '@/lib/skills/test-selection-validator';
import type { CheckOutcome, ContextualModifier, DynamicSkill, SkillCheck } from '@/lib/skills/types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function coreAttributeModifier(value: number) { return Math.floor((value - 10) / 2); }

export function skillProficiencyBonus(skill?: DynamicSkill) {
  if (!skill || skill.proficiencyRank === 'untrained') return 0;
  return Math.max(1, skill.level) + (skill.proficiencyRank === 'novice' ? 1 : 2);
}

export function determineOutcome(die: number, total: number, difficulty: number): CheckOutcome {
  if (die === 1) return 'critical_failure';
  if (die === 20) return 'critical_success';
  if (total >= difficulty + 8) return 'critical_success';
  if (total >= difficulty) return 'success';
  if (total >= difficulty - 2) return 'partial_success';
  return 'failure';
}

export function resolveSkillCheck(input: {
  id: string;
  turnId: string;
  characterId: string;
  attributeValue: number;
  skill?: DynamicSkill;
  difficulty: number;
  forcedDie?: number;
  advantage?: number;
  disadvantage?: number;
  contextualModifiers?: ContextualModifier[];
  opposedBy?: { label: string; defense: number };
}): Required<Pick<SkillCheck, 'rollResult' | 'totalResult' | 'outcome'>> & { check: SkillCheck; attributeBonus: number; skillBonus: number; contextualBonus: number } {
  const difficulty = clamp(input.opposedBy?.defense || input.difficulty, 5, 30);
  const advantage = Math.max(0, input.advantage || 0);
  const disadvantage = Math.max(0, input.disadvantage || 0);
  const dice = [clamp(input.forcedDie || Math.floor(Math.random() * 20) + 1, 1, 20)];
  if (input.forcedDie === undefined) for (let index = 0; index < Math.max(advantage, disadvantage); index += 1) dice.push(Math.floor(Math.random() * 20) + 1);
  const die = advantage > disadvantage ? Math.max(...dice) : disadvantage > advantage ? Math.min(...dice) : dice[0];
  const attributeBonus = coreAttributeModifier(input.attributeValue);
  const skillBonus = skillProficiencyBonus(input.skill);
  const contextualModifiers = input.contextualModifiers || [];
  const contextualBonus = contextualModifiers.reduce((sum, modifier) => sum + modifier.value, 0);
  const total = die + attributeBonus + skillBonus + contextualBonus;
  const outcome = determineOutcome(die, total, difficulty);
  const check: SkillCheck = {
    id: input.id,
    turnId: input.turnId,
    characterId: input.characterId,
    attribute: input.skill?.primaryAttribute || 'wisdom',
    skillId: input.skill?.id,
    difficultyClass: difficulty,
    opposedBy: input.opposedBy,
    advantage,
    disadvantage,
    contextualModifiers,
    rollResult: die,
    totalResult: total,
    outcome,
  };
  return { check, rollResult: die, totalResult: total, outcome, attributeBonus, skillBonus, contextualBonus };
}

export function meaningfulSkillXp(input: { difficulty: number; outcome: CheckOutcome; recentSameSkillUses: number; repeatedExactAction: number }) {
  if (input.repeatedExactAction >= 2 || input.recentSameSkillUses >= 4) return 0;
  const difficultyMultiplier = input.difficulty >= 22 ? 2 : input.difficulty >= 18 ? 1.7 : input.difficulty >= 15 ? 1.35 : input.difficulty >= 12 ? 1 : .65;
  const noveltyMultiplier = input.repeatedExactAction === 1 ? .35 : input.recentSameSkillUses >= 2 ? .6 : 1;
  const performanceMultiplier = input.outcome === 'critical_success' ? 1.5 : input.outcome === 'critical_failure' ? 1.1 : 1;
  return Math.max(0, Math.round(2 * difficultyMultiplier * noveltyMultiplier * performanceMultiplier));
}

export function progressDynamicSkill(skill: DynamicSkill, xp: number, outcome: CheckOutcome): DynamicSkill {
  let next = {
    ...skill,
    experience: skill.experience + Math.max(0, xp),
    usageCount: skill.usageCount + 1,
    successCount: skill.successCount + (['partial_success', 'success', 'critical_success'].includes(outcome) ? 1 : 0),
    failureCount: skill.failureCount + (['failure', 'critical_failure'].includes(outcome) ? 1 : 0),
    updatedAt: new Date().toISOString(),
  };
  while (next.experience >= next.experienceToNextLevel && next.level < 6) {
    next = { ...next, experience: next.experience - next.experienceToNextLevel, level: next.level + 1, proficiencyRank: proficiencyForLevel(next.level + 1), experienceToNextLevel: skillExperienceToNext(next.level + 1) };
  }
  return next;
}

export const SkillCheckEngine = { resolve: resolveSkillCheck, outcome: determineOutcome, xp: meaningfulSkillXp, progress: progressDynamicSkill };
