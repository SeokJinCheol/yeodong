import { useState } from 'react';
import { Button } from '../atoms/Button';
export function MoveDayForm({date,count,busy,onMove}:{date:string;count:number;busy:boolean;onMove:(target:string)=>Promise<void>}) {
  const [target,setTarget]=useState('');
  return <details className="move-day"><summary>일정 날짜 변경</summary><form onSubmit={async e=>{e.preventDefault();await onMove(target);}}>
    <p>{date}의 모든 구간과 장소 {count}개를 함께 옮깁니다. 머무르기 시간과 필수 도착 시각은 유지됩니다. 이미 일정이 있는 날짜로는 옮길 수 없습니다.</p>
    <label>변경할 날짜<input aria-label="일정 변경할 날짜" type="date" required value={target} onChange={e=>setTarget(e.target.value)}/></label>
    <Button variant="secondary" disabled={busy || !count || !target || target===date}>일정 옮기기</Button>
  </form></details>;
}
