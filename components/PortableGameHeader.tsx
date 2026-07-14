'use client';

import AmbientAudio from '@/components/AmbientAudio';
import Logo from '@/components/Logo';

type Props = {
  campaignName: string;
  level: number;
  day: number;
  hour: number;
  locationName: string;
  onMenu: () => void;
};

export default function PortableGameHeader({ campaignName, level, day, hour, locationName, onMenu }: Props) {
  return <header className="portable-header">
    <div className="portable-brand"><i className="power-pixel" aria-hidden="true"/><Logo variant="header" priority/></div>
    <div className="header-status">
      <small className="campaign-clock">{campaignName.toUpperCase()} · NV {level} · D{day} · {String(hour).padStart(2, '0')}:00</small>
      <AmbientAudio location={locationName}/>
      <button type="button" className="mobile-menu-toggle" onClick={onMenu}>MENU</button>
    </div>
  </header>;
}
