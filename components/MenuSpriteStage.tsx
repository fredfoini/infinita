export default function MenuSpriteStage() {
  const actors = ['runner', 'duelist-a', 'duelist-b', 'mage', 'trainer', 'playful'];
  return <div className="menu-sprite-stage" aria-hidden="true">{actors.map(actor => <i className={`menu-actor ${actor}`} key={actor}><span /></i>)}</div>;
}
