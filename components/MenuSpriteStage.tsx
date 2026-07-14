import PixelActor from '@/components/PixelActor';
import { createSpriteIdentity, type SpriteAnimation } from '@/lib/visual/sprite-system';

const actors: Array<{ id: string; label: string; className: string; animation: SpriteAnimation }> = [
  { id: 'menu-runner', label: 'viajante caminhando', className: 'menu-runner', animation: 'walk' },
  { id: 'menu-mage', label: 'estudiosa praticando magia', className: 'menu-mage', animation: 'cast' },
  { id: 'menu-fisher', label: 'pescador descansando', className: 'menu-fisher', animation: 'fishing' },
  { id: 'menu-crafter', label: 'artesã trabalhando', className: 'menu-crafter', animation: 'craft' },
  { id: 'menu-sleeper', label: 'aventureiro dormindo', className: 'menu-sleeper', animation: 'sleep' },
];

export default function MenuSpriteStage() {
  return <div className="menu-sprite-stage" aria-label="Pequenos aventureiros vivendo ao redor do menu">{actors.map(actor => <PixelActor key={actor.id} identity={createSpriteIdentity({ id: actor.id, name: actor.label, className: actor.animation })} animation={actor.animation} label={actor.label} compact className={actor.className} />)}</div>;
}
