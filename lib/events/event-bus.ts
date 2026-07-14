import type { GameEvent, GameState } from '@/lib/engine';

export type GameEventType =
  | 'ActionDeclared' | 'RollRequested' | 'RollResolved'
  | 'DamageApplied' | 'HealingApplied' | 'ManaSpent' | 'ManaRestored'
  | 'ItemAcquired' | 'ItemUsed' | 'ItemLost' | 'CurrencyChanged'
  | 'SpellLearned' | 'SpellCast' | 'QuestCreated' | 'QuestProgressed' | 'QuestCompleted'
  | 'NpcCreated' | 'NpcMoved' | 'NpcDied' | 'LocationCreated' | 'LocationDiscovered'
  | 'ReputationChanged' | 'WorldChanged';

export type EventDraft = {
  type: GameEventType;
  text: string;
  targetIds?: string[];
  payload?: Record<string, unknown>;
  source?: GameEvent['source'];
  priority?: number;
  persistent?: boolean;
};

/** Reduz eventos sobre sistemas inscritos. O estado mecânico continua sendo a fonte de verdade. */
export function reduceGameEvents(input: GameState, events: GameEvent[]): GameState {
  if (!events.length) return input;
  const state = structuredClone(input);
  const eventTypes = new Set(events.map(event => event.eventType));
  for (const quest of state.campaign.quests) {
    if (quest.status !== 'active') continue;
    let progressed = false;
    for (const objective of quest.objectives) {
      if (objective.completed || objective.status === 'failed') continue;
      const matching = events.filter(event => objective.eventSubscriptions.includes(event.eventType));
      if (!matching.length) continue;
      if (typeof objective.currentValue === 'number' && typeof objective.targetValue === 'number') {
        objective.currentValue = Math.min(objective.targetValue, objective.currentValue + matching.length);
        objective.completed = objective.currentValue >= objective.targetValue;
      } else {
        objective.currentValue = true;
        objective.completed = true;
      }
      objective.status = objective.completed ? 'completed' : 'active';
      progressed = true;
    }
    if (progressed && quest.objectives.every(objective => objective.completed)) quest.status = 'completed';
  }
  if (eventTypes.has('NpcDied')) {
    for (const quest of state.campaign.quests) {
      if (quest.status !== 'active') continue;
      const deadIds = events.filter(event => event.eventType === 'NpcDied').flatMap(event => event.targetIds);
      if (quest.relevantNpcIds.some(id => deadIds.includes(id))) {
        quest.status = 'failed';
        quest.memory.consequences.push('Uma pessoa ligada ao objetivo morreu; o mundo seguirá por outra consequência.');
      }
    }
  }
  return state;
}

export const EventBus = { reduce: reduceGameEvents };
