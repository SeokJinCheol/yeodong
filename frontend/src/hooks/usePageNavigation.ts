import { useEffect, useState } from 'react';

export type WorkspacePage = 'planner' | 'settings';
export function pageFromHash(hash: string): WorkspacePage {
    return hash === '#/settings' ? 'settings' : 'planner';
}

export function usePageNavigation() {
    const [page, setPage] = useState(() => pageFromHash(window.location.hash));
    useEffect(() => {
        const onNavigate = () => setPage(pageFromHash(window.location.hash));
        window.addEventListener('hashchange', onNavigate);
        return () => window.removeEventListener('hashchange', onNavigate);
    }, []);
    return page;
}
