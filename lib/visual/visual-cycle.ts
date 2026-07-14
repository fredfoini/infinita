export type VisualPhase = 'parchment' | 'illustration';

export interface CampaignVisualCycle {
  campaignId: string;
  validActionCount: number;
  phaseLength: 10;
  currentPhase: VisualPhase;
  phaseStartAction: number;
  activeIllustrationId?: string;
  lastGeneratedAtAction?: number;
  cycleVersion: 1;
}

export const VISUAL_CYCLE_CONFIG = Object.freeze({
  parchmentActions: 10,
  illustrationActions: 10,
  startMode: 'parchment' as const,
  generateAtIllustrationStart: true,
  preserveImageForWholePhase: true,
  fallbackToParchment: true,
});

export const PARCHMENT_ASSET_ID = 'ui_story_parchment_writing_v1';

export function visualPhaseForAction(actionCount: number): VisualPhase {
  if (actionCount <= 0) return VISUAL_CYCLE_CONFIG.startMode;
  const block = Math.floor((actionCount - 1) / VISUAL_CYCLE_CONFIG.parchmentActions);
  return block % 2 === 0 ? 'parchment' : 'illustration';
}

export function visualPhaseStart(actionCount: number) {
  if (actionCount <= 0) return 1;
  return Math.floor((actionCount - 1) / VISUAL_CYCLE_CONFIG.parchmentActions) * VISUAL_CYCLE_CONFIG.parchmentActions + 1;
}

export function createVisualCycle(campaignId: string, validActionCount = 0): CampaignVisualCycle {
  return {
    campaignId,
    validActionCount: Math.max(0, Math.floor(validActionCount)),
    phaseLength: 10,
    currentPhase: visualPhaseForAction(validActionCount),
    phaseStartAction: visualPhaseStart(validActionCount),
    cycleVersion: 1,
  };
}

export function advanceVisualCycle(cycle: CampaignVisualCycle): CampaignVisualCycle {
  const validActionCount = cycle.validActionCount + 1;
  const currentPhase = visualPhaseForAction(validActionCount);
  const phaseChanged = currentPhase !== cycle.currentPhase;
  return {
    ...cycle,
    validActionCount,
    currentPhase,
    phaseStartAction: visualPhaseStart(validActionCount),
    activeIllustrationId: phaseChanged ? undefined : cycle.activeIllustrationId,
  };
}

export function attachCycleIllustration(cycle: CampaignVisualCycle, assetId: string, generated = false): CampaignVisualCycle {
  if (cycle.currentPhase !== 'illustration' || !assetId.trim()) return cycle;
  return {
    ...cycle,
    activeIllustrationId: assetId,
    lastGeneratedAtAction: generated ? cycle.validActionCount : cycle.lastGeneratedAtAction,
  };
}

export function migrateVisualCycle(value: unknown, campaignId: string, fallbackActions = 0): CampaignVisualCycle {
  if (!value || typeof value !== 'object') return createVisualCycle(campaignId, fallbackActions);
  const candidate = value as Partial<CampaignVisualCycle>;
  const validActionCount = Math.max(0, Math.floor(Number(candidate.validActionCount) || 0));
  const currentPhase = visualPhaseForAction(validActionCount);
  return {
    campaignId,
    validActionCount,
    phaseLength: 10,
    currentPhase,
    phaseStartAction: visualPhaseStart(validActionCount),
    activeIllustrationId: currentPhase === 'illustration' ? candidate.activeIllustrationId : undefined,
    lastGeneratedAtAction: Number.isFinite(candidate.lastGeneratedAtAction) ? candidate.lastGeneratedAtAction : undefined,
    cycleVersion: 1,
  };
}
