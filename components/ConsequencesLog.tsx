import type { GameEvent } from '@/lib/engine';

const ICON: Partial<Record<GameEvent['type'], string>> = {
  world: '◆', quest: '⚑', xp: '✦', level: '▲', roll: '⬡', combat: '⚔', reputation: '●', item: '◇', gold: '¤', magic: '✧', skill: '+',
};

export default function ConsequencesLog({ events }: { events: GameEvent[] }) {
  const important = events.filter(event => event.priority >= 55 || event.persistent).slice(0, 4);
  return <section className="events" aria-label="Registro de consequências">
    <h3>REGISTRO DE CONSEQUÊNCIAS</h3>
    {important.length
      ? important.map(event => <p key={event.id} className={`event ${event.type}`}><i aria-hidden="true">{ICON[event.type] || '·'}</i><span>{event.text}</span></p>)
      : <p className="event quiet"><i aria-hidden="true">·</i><span>Nenhuma consequência importante registrada.</span></p>}
  </section>;
}
