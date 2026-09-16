import type { ReactNode } from 'react';
import { Compass, Route } from 'lucide-react';
export function PlannerLayout({children}: {children: ReactNode}) { return <><header className="app-header"><a className="brand" href="/"><span><Route size={23}/></span>여동<span className="brand-sub">여행의 동선을 잇다</span></a><div className="header-right"><span className="header-active"><Compass size={16}/>여행 플래너</span><span className="avatar">여</span></div></header><main>{children}</main><footer className="app-footer"><span>여동 · 더 적게 헤매고, 더 많이 여행하세요.</span><span>TRAVEL AT YOUR OWN PACE</span></footer></>; }
