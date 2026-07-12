export type ClassName = 'Guerreiro' | 'Explorador' | 'Ladino' | 'Místico';
export type Skill = { xp: number; level: number; trained: boolean };
export type Reputation = { global: number; local: number; regional: number; npcs: Record<string, number> };
export type Event = { kind: 'xp' | 'skill' | 'title' | 'moral' | 'level' | 'roll'; text: string; amount?: number };
export type GameState = {
  campaignId: string; campaignName: string; characterName: string; className: ClassName;
  hp: number; maxHp: number; level: number; xp: number; xpToNext: number; gold: number;
  location: string; day: number; hour: number; inventory: string[]; log: string[];
  skills: Record<string, Skill>; titles: string[]; reputation: Reputation; events: Event[]; sceneImage?: string;
};

const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const cap = (level: number) => Math.floor(100 * Math.pow(level, 1.42));
const initialSkill = (seed: string): Skill => ({ xp: 0, level: 1, trained: Array.from(seed).reduce((n, c) => n + c.charCodeAt(0), 0) % 3 === 0 });

export function initialState(characterName = 'Viajante', campaignName = 'Nova campanha', className: ClassName = 'Explorador'): GameState {
  const classSkill: Record<ClassName, string> = { Guerreiro: 'Combate', Explorador: 'Sobrevivência', Ladino: 'Furtividade', Místico: 'Arcana' };
  const skills = Object.fromEntries(['Corrida', 'Pesca', 'Acrobacia', 'Furtividade', 'Sobrevivência', 'Combate', 'Diplomacia', 'Arcana'].map(s => [s, initialSkill(`${characterName}${s}`)]));
  skills[classSkill[className]] = { xp: 20, level: 1, trained: true };
  const start: Record<ClassName, string> = {
    Guerreiro: 'Você deixa o pátio de treinamento com uma espada sem nome e uma promessa antiga.',
    Explorador: 'Você chega a Valedouro com mapas úmidos e a intuição de que a estrada não termina ali.',
    Ladino: 'Você entra em Valedouro antes da noite fechar os portões, sem que os guardas memorizem seu rosto.',
    Místico: 'As runas do seu caderno vibram quando a neblina de Valedouro toca suas botas.'
  };
  return { campaignId: id(), campaignName, characterName, className, hp: 12, maxHp: 12, level: 1, xp: 0, xpToNext: cap(1), gold: 8, location: 'Vila de Valedouro', day: 1, hour: 18, inventory: ['3 rações', 'Tocha'], skills, titles: [], reputation: { global: 0, local: 0, regional: 0, npcs: {} }, events: [], log: [start[className]] };
}

function skillFor(action: string) {
  const a = action.toLowerCase();
  if (/pesca|pescar|anzol|peixe/.test(a)) return 'Pesca'; if (/corro|correr|corrida|fugir/.test(a)) return 'Corrida';
  if (/escalar|saltar|pular|acrob/.test(a)) return 'Acrobacia'; if (/furt|roub|esconder|silêncio/.test(a)) return 'Furtividade';
  if (/atac|lutar|golpear|espada/.test(a)) return 'Combate'; if (/falar|perguntar|convencer|negociar/.test(a)) return 'Diplomacia';
  if (/magia|runa|feitiço|arcano/.test(a)) return 'Arcana'; return 'Sobrevivência';
}
function titleFor(skill: string, action: string) {
  const names: Record<string, string[]> = { Corrida: ['Passo da Areia', 'Pulmão do Vento'], Pesca: ['Mão do Riacho', 'Olho da Maré'], Acrobacia: ['Gato das Ruínas', 'Salto de Bruma'], Furtividade: ['Sombra de Vidro', 'Passo sem Sino'], Combate: ['Fio Desperto', 'Punho de Carvalho'], Diplomacia: ['Voz de Ponte', 'Língua de Prata'], Arcana: ['Leitor de Cinzas', 'Selo Errante'], Sobrevivência: ['Filho da Estrada', 'Nariz de Tempestade'] };
  const list = names[skill] || ['Caminhante Infinito']; return list[(action.length + skill.length) % list.length];
}

export function advanceDemo(state: GameState, action: string) {
  const skill = skillFor(action); const old = state.skills[skill] || initialSkill(skill); const gain = old.trained ? 18 : 10;
  const updated = { ...old, xp: old.xp + gain }; const events: Event[] = [{ kind: 'xp', text: `+${gain} XP de ${skill}${old.trained ? ' (talento oculto)' : ''}`, amount: gain }];
  if (updated.xp >= cap(updated.level)) { updated.level++; updated.xp = 0; events.push({ kind: 'skill', text: `${skill} subiu para nível ${updated.level}.` }); }
  const skills = { ...state.skills, [skill]: updated }; let xp = state.xp + gain; let level = state.level; let maxHp = state.maxHp; let hp = state.hp; let xpToNext = cap(level);
  while (xp >= xpToNext) { xp -= xpToNext; level++; maxHp += 3; hp = maxHp; xpToNext = cap(level); events.push({ kind: 'level', text: `NÍVEL ${level}! Vitalidade máxima +3.` }); }
  const npc = /estalajadeiro|guarda|mulher|pescador/.exec(action.toLowerCase())?.[0]; const rep = { ...state.reputation, npcs: { ...state.reputation.npcs } };
  if (npc) { const delta = /ajud|gentil|pagar|agrade/.test(action.toLowerCase()) ? 2 : 1; rep.npcs[npc] = (rep.npcs[npc] || 0) + delta; rep.local += delta; events.push({ kind: 'moral', text: `Moral com ${npc}: ${delta > 0 ? '+' : ''}${delta}. Reputação local: ${rep.local}.` }); }
  if (updated.xp >= 35 && !state.titles.includes(titleFor(skill, action))) { const title = titleFor(skill, action); events.push({ kind: 'title', text: `Novo título: ${title}. Poder latente: uma vantagem narrativa ligada a ${skill}.` }); }
  const needsRoll = /atacar|roubar|escalar|correr|ameaçar|arrombar|furtar|pescar/.test(action.toLowerCase()); if (needsRoll) events.push({ kind: 'roll', text: `Teste de ${skill}: d20 + ${updated.level - 1}. CD 12.` });
  const lower = action.toLowerCase(); const location = lower.includes('taverna') ? 'Taverna da Lua' : lower.includes('floresta') ? 'Floresta Velha' : lower.includes('riacho') || lower.includes('rio') ? 'Riacho de Valedouro' : state.location;
  const narrative = needsRoll ? `Sua tentativa de ${action.trim()} é arriscada e o resultado importa. Faça um teste de ${skill}: d20 + ${updated.level - 1} contra CD 12 para descobrir a consequência.` : location === 'Taverna da Lua' ? 'A porta da Taverna da Lua range. Uma mulher encapuzada se imobiliza no canto; o estalajadeiro mede você com os olhos. “Você não é daqui, é?” O que você faz?' : `Você ${action.trim()}. O mundo registra esse gesto e a estrada guarda uma consequência para depois. O que você faz?`;
  return { narrative, needsRoll, rollSkill: needsRoll ? skill : null, rollDifficulty: needsRoll ? 12 : null, scene: location, locationChanged: location !== state.location, events, state: { ...state, hp, maxHp, xp, xpToNext, level, skills, reputation: rep, location, hour: state.hour === 23 ? 0 : state.hour + 1, log: [...state.log, action], events, titles: events.some(e => e.kind === 'title') ? [...state.titles, titleFor(skill, action)] : state.titles } };
}
