import { useEffect, useRef, useState } from 'react';
import { Map as MapIcon, Navigation } from 'lucide-react';
import { api } from '../../lib/api';
import type { Plan, Place, MapPlace } from '../../lib/types';

let mapsPromise: Promise<void> | undefined;
function loadMaps(key: string) {
  if (!mapsPromise) mapsPromise = new Promise<void>((resolve,reject)=>{
    const name = '__yeodongMapsReady';
    (window as unknown as Record<string,unknown>)[name] = ()=>resolve();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${name}&loading=async&language=ko`;
    script.onerror = ()=>reject(new Error('지도를 불러오지 못했습니다. 브라우저 API 키와 네트워크를 확인해 주세요.'));
    document.head.append(script);
  });
  return mapsPromise;
}

export function RouteMap({plan, selectedPlace, fallbackPlaces=[], onAddPlace}: {plan: Plan | null; selectedPlace?: Place; fallbackPlaces?:Place[];onAddPlace?:(position:MapPlace)=>void}) {
  const addRef=useRef(onAddPlace);
  addRef.current=onAddPlace;
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<{marker:google.maps.Marker; ids:number[]; label:string}[]>([]);
  const selectedRef = useRef(selectedPlace);
  selectedRef.current = selectedPlace;
  const highlight = () => {
    const selected=selectedRef.current;
    markersRef.current.forEach(({marker,ids,label})=>{
      const active=!!selected && ids.includes(selected.id);
      marker.setIcon({path:google.maps.SymbolPath.CIRCLE,scale:label.length>2?25:active?21:16,fillColor:active?'#d77924':'#27634d',fillOpacity:1,strokeColor:'#fff',strokeWeight:active?5:3});
      marker.setZIndex(active?1000:label==='출발·도착'?900:1);
    });
    if(selected && mapRef.current) {mapRef.current.panTo(selected);mapRef.current.setZoom(16);}
  };
  const ref = useRef<HTMLDivElement>(null);
  const [error,setError] = useState('');
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const displayPlaces=plan?.places??fallbackPlaces;
  const mapGeometry=JSON.stringify({places:displayPlaces.map(({id,lat,lng,name})=>({id,lat,lng,name})),coordinates:plan?.coordinates??[]});
  useEffect(()=>{
    if(!key) return;
    setError('');
    let cancelled = false;
    let info:google.maps.InfoWindow | undefined;
    let clickVersion=0;
    const overlays: (google.maps.Marker | google.maps.Polyline)[] = [];
    loadMaps(key).then(()=>{
      if(cancelled || !ref.current) return;
      const map = new google.maps.Map(ref.current,{center:displayPlaces[0] ?? selectedPlace ?? {lat:35.6812,lng:139.7671},zoom:14,mapTypeControl:false,streetViewControl:false});
      mapRef.current=map;
      info=new google.maps.InfoWindow();
      info.addListener('closeclick',()=>{clickVersion++;});
      const showPlace=(place:MapPlace)=>{
        const content=document.createElement('div');content.className='map-place-popup';
        const title=document.createElement('strong');title.textContent=place.name??'선택한 위치';
        const address=document.createElement('p');address.textContent=place.address??'';
        const add=document.createElement('button');add.type='button';add.textContent='위치 추가';
        add.onclick=()=>{info?.close();addRef.current?.(place);};
        content.append(title,address,add);info?.setContent(content);info?.setPosition(place);info?.open({map});
      };
      map.addListener('click',async(event:google.maps.IconMouseEvent)=>{
        const version=++clickVersion;
        if(!event.placeId){info?.close();return;}
        event.stop();
        info?.setPosition(event.latLng);info?.setContent('장소 정보를 불러오는 중…');info?.open({map});
        try {
          const place=await api<MapPlace>(`/map-place?place_id=${encodeURIComponent(event.placeId)}`);
          if(!cancelled && version===clickVersion)showPlace(place);
        } catch(e){if(!cancelled && version===clickVersion){const message=document.createElement('p');message.textContent=(e as Error).message;info?.setContent(message);}}
      });
      const addAtPosition=(event:google.maps.MapMouseEvent)=>{
        if(event.latLng)addRef.current?.({lat:event.latLng.lat(),lng:event.latLng.lng()});
      };
      map.addListener('contextmenu',addAtPosition);
      map.addListener('rightclick',addAtPosition);
      const bounds = new google.maps.LatLngBounds();
      const points=displayPlaces;
      const visible=selectedPlace && !points.some(p=>p.id===selectedPlace.id)?[...points,selectedPlace]:points;
      const groups=new Map<string,{place:Place;ids:number[];labels:string[]}>();
      visible.forEach((p,i)=>{
        const coord=`${p.lat},${p.lng}`;
        const group=groups.get(coord) ?? {place:p,ids:[],labels:[]};
        group.ids.push(p.id);
        group.labels.push(i===0 && points.length>1?'出':i===points.length-1 && points.length>1?'到':String(i));
        groups.set(coord,group);
      });
      markersRef.current=[];
      groups.forEach(({place,ids,labels})=>{
        const label=labels.includes('出') && labels.includes('到')?'출발·도착':labels.map(l=>l==='出'?'출발':l==='到'?'도착':l).join('/');
        bounds.extend(place);
        const marker=new google.maps.Marker({map,position:place,label:{text:label,color:'#ffffff',fontSize:label.length>2?'10px':'12px'},title:`${place.name} · ${label}`});
        marker.addListener('click',()=>{clickVersion++;showPlace(place);});
        markersRef.current.push({marker,ids,label});overlays.push(marker);
      });
      if(plan) overlays.push(new google.maps.Polyline({map,path:plan.coordinates.map(([lng,lat])=>({lat,lng})),strokeColor:'#27634d',strokeOpacity:0.9,strokeWeight:5}));
      if(!plan && points.length>1) overlays.push(new google.maps.Polyline({map,path:points,strokeOpacity:0,icons:[{icon:{path:'M 0,-1 0,1',strokeOpacity:0.7,strokeColor:'#a47a50',scale:3},offset:'0',repeat:'14px'}]}));
      if(visible.length)map.fitBounds(bounds,65);
      highlight();
    }).catch(e=>{if(!cancelled)setError(e.message);});
    return ()=>{cancelled=true;info?.close();if(info)google.maps.event.clearInstanceListeners(info);if(mapRef.current)google.maps.event.clearInstanceListeners(mapRef.current);mapRef.current=null;markersRef.current=[];overlays.forEach(o=>{google.maps.event.clearInstanceListeners(o);o.setMap(null);});};
  },[key,mapGeometry,selectedPlace && !displayPlaces.some(p=>p.id===selectedPlace.id)?selectedPlace.id:null]);
  useEffect(()=>{if(mapRef.current)highlight();},[selectedPlace]);
  const places = displayPlaces.length?displayPlaces:(selectedPlace?[selectedPlace]:[]);
  const selectedLabel=selectedPlace ? `${selectedPlace.name} · 선택한 장소` : '';
  const lngs=places.map(p=>p.lng), lats=places.map(p=>p.lat);
  const minX=Math.min(...lngs),maxX=Math.max(...lngs),minY=Math.min(...lats),maxY=Math.max(...lats);
  const pts=places.map(p=>({x:85+(p.lng-minX)/(maxX-minX || 1)*530,y:95+(maxY-p.lat)/(maxY-minY || 1)*350}));
  return <section className="map-panel"><div className="map-heading"><span><MapIcon size={17}/>오늘의 여행 지도</span><span className="map-status">{key?'Google Maps':'미리보기'}</span></div>{key && onAddPlace && <p className="map-position-note">장소 아이콘 클릭 → 위치 추가 · 빈 지도는 우클릭으로 추가</p>}{selectedLabel && <div className="map-selection">{selectedLabel}</div>}{key ? <div ref={ref} className="google-map"/> : <div className="illustrated-map"><svg viewBox="0 0 700 540" role="img" aria-label="등록한 좌표를 연결한 동선 개념도. 실제 도로 지도가 아닙니다."><defs><pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)"><rect width="64" height="64" fill="#eeede6"/><path d="M 64 0 L 0 0 0 64" fill="none" stroke="#fff" strokeWidth="9"/></pattern><filter id="shadow"><feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity=".13"/></filter></defs><rect width="700" height="540" fill="url(#grid)"/><path d="M540 -30 Q420 190 570 320 T540 590" stroke="#d1e4e5" strokeWidth="38" fill="none"/><path d="M-50 420 L750 60" stroke="#fff" strokeWidth="24"/><path d="M-50 420 L750 60" stroke="#e1d8bb" strokeWidth="2" strokeDasharray="8 6"/><rect x="65" y="50" width="120" height="80" rx="26" fill="#d8e2ca" transform="rotate(-14 65 50)"/><rect x="475" y="362" width="148" height="92" rx="25" fill="#d8e2ca" transform="rotate(-14 475 362)"/>{pts.length>1 && <polyline points={pts.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#367358" strokeWidth="4" strokeDasharray="8 5" strokeLinejoin="round"/>}{pts.map((p,i)=> i===pts.length-1 && i>0 && places[0].lat===places[i].lat && places[0].lng===places[i].lng ? null : <g key={i} filter="url(#shadow)"><circle cx={p.x} cy={p.y} r={selectedPlace?.id===places[i].id?24:21} fill={selectedPlace?.id===places[i].id?'#d77924':'#27634d'} stroke="white" strokeWidth="4"/><text x={p.x} y={p.y+5} fill="white" textAnchor="middle" fontSize="13" fontWeight="700">{i===0 && places.length>1 && places[0].lat===places.at(-1)!.lat && places[0].lng===places.at(-1)!.lng?'출/도':i===0?'출발':i===places.length-1?'도착':i+1}</text><rect x={Math.min(510,Math.max(10,p.x-65))} y={p.y+23} width="160" height="28" rx="7" fill="white"/><text x={Math.min(510,Math.max(10,p.x-65))+80} y={p.y+42} textAnchor="middle" fontSize="11" fill="#253b32">{places[i].name.slice(0,18)}</text></g>)}</svg><div className="map-disclaimer"><Navigation size={15}/><span>좌표 기반 동선 개념도 · 배경은 실제 지도가 아닙니다</span></div></div>}{error && <p className="error" role="alert">{error}</p>}<div className="map-footer"><i/><span>{!plan?'방문 순서만 표시 · 점선은 실제 이동 경로가 아닙니다':plan.source==='google'?'실제 도로를 따라 계산한 경로':'직선거리 기반 추정'}</span></div></section>;
}
