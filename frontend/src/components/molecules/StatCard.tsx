import type { ReactNode } from 'react';
export function StatCard({icon, label, value}: {icon: ReactNode; label: string; value: string}) { return <div className="stat-card"><div>{icon}<span>{label}</span></div><strong>{value}</strong></div>; }
