'use client';
import { FormEvent, useEffect, useState } from 'react';
import { initialState, type GameState } from '@/lib/engine';

type Reply = { narrative: string; needsRoll: boolean; rollDifficulty: number | null; scene: string; state: GameState };
const key = 'infinita-campaign-v1';

export default function Game() {
  const [state, setState] = useState<GameState>(initialState());
  const [text, setText] = useState(''); const [story, setStory] = useState('A chuva fina cai sobre Valedouro. O portão norte está aberto, e uma luz vacila na Taverna da Lua. O que você faz?');
  const [scene, setScene] = useState('village'); const [needsRoll, setNeedsRoll] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { const saved = localStorage.getItem(key); if (saved) { const data = JSON.parse(saved); setState(data.state); setStory(data.story); setScene(data.scene || 'village'); } }, []);
  useEffect(() => { localStorage.setItem(key, JSON.stringify({ state, story, scene })); }, [state, story, scene]);
  async function play(action: string) { if (!action.trim() || busy) return; setBusy(true); setText(''); try { const r = await fetch('/api/turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, state }) }); const data: Reply = await r.json(); setStory(data.narrative); setState(data.state); setScene(data.scene); setNeedsRoll(data.needsRoll); } finally { setBusy(false); } }
  function submit(e: FormEvent) { e.preventDefault(); play(text); }
  function roll() { const n = Math.floor(Math.random() * 20) + 1; setStory(`Você rola o dado: ${n}. ${n >= 12 ? 'Sucesso. O destino abre uma fresta diante de você.' : 'Falha. O mundo responde, e guarda memória disso.'} O que você faz?`); setNeedsRoll(false); }
  return <div className="shell"><header><span>INFINITA</span><small>CAMPANHA 01 · D{state.day} · {String(state.hour).padStart(2, '0')}:00</small></header><div className="grid"><section className="adventure"><div className={`scene ${scene}`}><div className="moon" /><div className="mountains" /><div className="ground" /><div className="hero">♟</div><div className="scene-name">{state.location}</div></div><article className="narrative">{story}</article></section><aside><h2>VIAJANTE</h2><div className="stat"><span>VITALIDADE</span><b>{state.hp}/{state.maxHp}</b></div><div className="bar"><i style={{ width: `${state.hp / state.maxHp * 100}%` }} /></div><div className="stat"><span>EXPERIÊNCIA</span><b>{state.xp}</b></div><div className="stat"><span>MOEDAS</span><b>{state.gold} G</b></div><hr /><h3>MOCHILA</h3><ul>{state.inventory.map(x => <li key={x}>› {x}</li>)}</ul><hr /><h3>RUMORES</h3><p className="rumor">{state.log.at(-1)}</p></aside></div><form onSubmit={submit}><label htmlFor="action">O QUE VOCÊ FAZ?</label><div className="input-row"><input id="action" value={text} onChange={e => setText(e.target.value)} placeholder="Escreva sua ação..." autoComplete="off" disabled={busy} /><button type="submit" disabled={busy}>{busy ? '...' : 'ENVIAR'}</button>{needsRoll && <button type="button" className="dice" onClick={roll}>D20</button>}</div></form><footer>MEMÓRIA DA CAMPANHA ATIVA <span>●</span></footer></div>;
}
