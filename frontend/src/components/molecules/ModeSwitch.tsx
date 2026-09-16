import { Car, Footprints, TrainFront, Map } from 'lucide-react';
import type { Mode } from '../../lib/types';
export function ModeSwitch({value, onChange, unavailable={}}: {value: Mode | 'MAP'; unavailable?:Partial<Record<Mode | 'MAP',string>>; onChange: (mode: Mode | 'MAP') => void}) {
  return <div className="mode-switch" aria-label="이동수단">{([['MAP','Map',Map],['WALK','도보',Footprints],['DRIVE','차량',Car],['TRANSIT','대중교통',TrainFront]] as const).map(([mode,label,Icon]) => <button key={mode} aria-pressed={value === mode} title={unavailable[mode]} aria-disabled={!!unavailable[mode]} className={`${value === mode ? 'active' : ''} ${unavailable[mode]?'unavailable':''}`} onClick={() => {if(!unavailable[mode])onChange(mode);}}><Icon size={16}/>{label}</button>)}</div>;
}
