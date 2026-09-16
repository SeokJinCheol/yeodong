import { Footprints, TrainFront } from 'lucide-react';
import type { Leg } from '../../lib/types';
import { minutes } from '../../lib/api';

function time(value: string | undefined, zone: string) {
  return value ? new Date(value).toLocaleTimeString('ko-KR',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false}) : '시각 미제공';
}

export function TransitLeg({leg,timeZone}: {leg:Leg;timeZone:string}) {
  const rides=leg.steps.filter(s=>s.mode==='TRANSIT');
  return <div className="transit-leg"><div className="transit-summary">{time(leg.departure_time,timeZone)} 출발 → {time(leg.arrival_time,timeZone)} 도착<span>{rides.length ? `환승 ${leg.transfer_count}회` : '도보만으로 연결'}</span></div>
    {leg.steps.map((step,i)=><div className="transit-step" key={i}>{step.mode==='TRANSIT'?<TrainFront size={14}/>:<Footprints size={14}/>}<div>{step.mode==='TRANSIT'?<><strong>{step.line || step.vehicle}{step.line_name && step.line_name!==step.line ? ` · ${step.line_name}` : ''}</strong><p>{step.departure_stop} → {step.arrival_stop}</p><p>{time(step.departure_time,timeZone)} 승차 · {time(step.arrival_time,timeZone)} 하차{step.stop_count!=null ? ` · ${step.stop_count}개 정류장` : ''}</p>{step.headsign && <p>{step.headsign} 방면</p>}{step.agencies.map((agency,j)=><span className="transit-agency" key={j}>{/^https?:\/\//.test(agency.url)?<a href={agency.url} target="_blank" rel="noreferrer">{agency.name}</a>:agency.name}</span>)}</>:<><strong>도보 {minutes(step.duration_seconds/60)} · {step.distance_meters}m</strong><p>{step.instruction || '승하차 지점 또는 다음 장소로 이동'}</p></>}</div></div>)}
    {leg.warnings.map((warning,i)=><p className="transit-note" key={i}>{warning}</p>)}
  </div>;
}
