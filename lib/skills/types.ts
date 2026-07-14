export type CoreAttribute = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export type ActionDomain =
  | 'combat' | 'movement' | 'social' | 'romance' | 'knowledge' | 'craft'
  | 'survival' | 'perception' | 'stealth' | 'commerce' | 'magic'
  | 'performance' | 'medicine' | 'exploration' | 'general';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'extreme';
export type ProficiencyRank = 'untrained' | 'novice' | 'apprentice' | 'competent' | 'expert' | 'master' | 'legendary';
export type CheckOutcome = 'critical_failure' | 'failure' | 'partial_success' | 'success' | 'critical_success';

export type ActionInterpretation = {
  rawAction: string;
  intent: string;
  domain: ActionDomain;
  proposedSkill: string;
  proposedAttribute: CoreAttribute;
  actionMethod: string;
  targetId?: string;
  requiresRoll: boolean;
  opposed: boolean;
  riskLevel: RiskLevel;
  reasoning: string;
  possibleExistingSkillKeys: string[];
  trainable: boolean;
  trivial: boolean;
  consentRequired?: boolean;
};

export type DynamicSkill = {
  id: string;
  campaignId: string;
  characterId: string;
  name: string;
  normalizedKey: string;
  domain: ActionDomain;
  description: string;
  primaryAttribute: CoreAttribute;
  alternativeAttributes: CoreAttribute[];
  level: number;
  experience: number;
  experienceToNextLevel: number;
  proficiencyRank: ProficiencyRank;
  usageCount: number;
  successCount: number;
  failureCount: number;
  createdDynamically: boolean;
  sourceAction?: string;
  parentSkillId?: string;
  specializations: string[];
  legacyImported?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ContextualModifier = { id: string; label: string; value: number; source: 'environment' | 'equipment' | 'condition' | 'relationship' | 'method' };

export type SkillResolutionAudit = {
  id: string;
  campaignId: string;
  turnId: string;
  rawPlayerAction: string;
  interpretedIntent: string;
  domain: ActionDomain;
  llmProposedAttribute?: CoreAttribute;
  llmProposedSkill?: string;
  engineSelectedAttribute: CoreAttribute;
  engineSelectedSkillId?: string;
  engineSelectedSkillName?: string;
  newSkillCreated: boolean;
  corrections: string[];
  requiresRoll: boolean;
  difficulty?: number;
  riskLevel: RiskLevel;
  opposed: boolean;
  reasoning: string;
  createdAt: string;
};

export type SkillCheck = {
  id: string;
  turnId: string;
  characterId: string;
  attribute: CoreAttribute;
  skillId?: string;
  difficultyClass?: number;
  opposedBy?: { label: string; defense: number };
  advantage: number;
  disadvantage: number;
  contextualModifiers: ContextualModifier[];
  rollResult?: number;
  totalResult?: number;
  outcome?: CheckOutcome;
};

export type ValidatedTestSelection = {
  interpretation: ActionInterpretation;
  attribute: CoreAttribute;
  skillName: string;
  normalizedSkillKey: string;
  existingSkillId?: string;
  createSkill: boolean;
  requiresRoll: boolean;
  difficulty?: number;
  opposed: boolean;
  opposedBy?: { label: string; defense: number };
  advantage: number;
  disadvantage: number;
  contextualModifiers: ContextualModifier[];
  corrections: string[];
  audit: SkillResolutionAudit;
};
