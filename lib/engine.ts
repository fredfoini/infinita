export type GameState = { hp: number; maxHp: number; xp: number; gold: number; location: string; day: number; hour: number; inventory: string[]; log: string[]; reputation: number };
export const initialState = (): GameState => ({ hp: 12, maxHp: 12, xp: 0, gold: 8, location: 'Vila de Valedouro', day: 1, hour: 18, inventory: ['Adaga simples', '3 rações', 'Tocha'], reputation: 0, log: ['Você chegou a Valedouro ao cair da noite.'] });

export function advanceDemo(state: GameState, action: string) {
  const lower = action.toLowerCase();
  const needsRoll = /atacar|roubar|escalar|correr|ameaçar|arrombar|furtar/.test(lower);
  const scene = lower.includes('taverna') ? 'tavern' : lower.includes('floresta') ? 'forest' : lower.includes('rio') ? 'river' : 'village';
  const narrative = lower.includes('taverna')
    ? 'A porta da Taverna da Lua Range quando você entra. Uma mulher de capuz esconde o rosto no canto e o estalajadeiro para de polir o copo. “Você não é daqui, é?” O que você faz?'
    : needsRoll
      ? 'O risco é real, e o mundo não vai aliviar para você. Faça uma rolagem de d20 antes de descobrir a consequência. O que você faz?'
      : `Você ${action.trim()}. A vila parece ouvir cada passo; uma janela se fecha e, ao longe, o sino marca mais uma hora. O que você faz?`;
  const next = { ...state, hour: state.hour === 23 ? 0 : state.hour + 1, xp: state.xp + 5, log: [...state.log, action] };
  return { narrative, needsRoll, rollDifficulty: needsRoll ? 12 : null, scene, state: next };
}
