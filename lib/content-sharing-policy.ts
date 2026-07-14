import type { GameState } from '@/lib/engine';

export type CampaignSharingMode = 'global' | 'local-only';

export type GlobalContributionDecision = {
  mode: CampaignSharingMode;
  reason?: 'explicit-sexual-content' | 'graphic-violence' | 'hate-or-extremism' | 'severe-cruelty-or-destruction';
};

const explicitSexual = /porn|sexo expl[ií]cito|nudez expl[ií]cita|estupr|viol[eê]ncia sexual|genit[aá]l/i;
const graphicViolence = /decapit|desmembr|eviscer|v[ií]scera|canibal|tortur|sangue jorr|viol[eê]ncia gr[aá]fica/i;
const hateOrExtremism = /supremac|exterm[ií]nio|limpeza [ée]tnica|propaganda de [oó]dio|nazis|grupo protegido.*(?:eliminar|exterminar)/i;
const severeCruelty = /mestre do mal|tornar (?:o )?mundo em ru[ií]nas|massacr|assassinar inocentes|queimar .{0,50}(?:vivo|amarrad)|incendiar .{0,50}(?:amarrad|pessoas)|crueldade extrema/i;

export function classifyGlobalContribution(text: string): GlobalContributionDecision {
  const normalized = String(text || '').normalize('NFC').slice(0, 6000);
  if (explicitSexual.test(normalized)) return { mode: 'local-only', reason: 'explicit-sexual-content' };
  if (graphicViolence.test(normalized)) return { mode: 'local-only', reason: 'graphic-violence' };
  if (hateOrExtremism.test(normalized)) return { mode: 'local-only', reason: 'hate-or-extremism' };
  if (severeCruelty.test(normalized)) return { mode: 'local-only', reason: 'severe-cruelty-or-destruction' };
  return { mode: 'global' };
}

export function campaignContributionDecision(state: GameState, latestAction = ''): GlobalContributionDecision {
  if (state.campaign.sharingMode === 'local-only') return { mode: 'local-only', reason: state.campaign.sharingReason };
  return classifyGlobalContribution([state.campaign.originPrompt, ...state.session.recentActions.slice(-6), latestAction].join('\n'));
}

export function applyCampaignSharingDecision(state: GameState, latestAction = ''): GameState {
  const decision = campaignContributionDecision(state, latestAction);
  if (decision.mode === 'global') return state;
  return { ...state, campaign: { ...state.campaign, sharingMode: 'local-only', sharingReason: decision.reason } };
}

export const ContentSharingPolicy = { classify: classifyGlobalContribution, classifyCampaign: campaignContributionDecision, apply: applyCampaignSharingDecision };
