import { useEffect, useRef, useState } from 'react';
import { PlannerLayout } from '../components/templates/PlannerLayout';
import { usePlannerData } from '../hooks/usePlannerData';
import { usePageNavigation } from '../hooks/usePageNavigation';
import { PlannerPage } from './PlannerPage';
import { SettingsPage } from './SettingsPage';

export function WorkspacePage() {
    const data = usePlannerData();
    const page = usePageNavigation();
    const [plannerVisited, setPlannerVisited] = useState(page === 'planner');
    const content = useRef<HTMLDivElement>(null);
    const previousPage = useRef(page);
    useEffect(() => {
        if (page === 'planner') setPlannerVisited(true);
        if (previousPage.current !== page) {
            previousPage.current = page;
            window.scrollTo(0, 0);
            content.current?.focus({ preventScroll: true });
        }
    }, [page]);

    return (
        <PlannerLayout>
            <div
                ref={ content }
                tabIndex={ -1 }
                className="workspace-page"
            >
                {/* Keep planner state and map alive when visiting settings. */ }
                <div hidden={ page !== 'planner' }>
                    {
                        (plannerVisited || page === 'planner') && (
                            <PlannerPage
                                data={ data }
                                active={ page === 'planner' }
                            />
                        )
                    }
                </div>
                {
                    page === 'settings' && (
                        <SettingsPage
                            busy={ data.mutating || data.settingsPending > 0 || !data.loaded }
                            trash={ data.trash }
                            onRestore={ data.restoreTrash }
                            runMutation={ data.runMutation }
                            error={ data.error }
                        />
                    )
                }
            </div>
        </PlannerLayout>
    );
}
