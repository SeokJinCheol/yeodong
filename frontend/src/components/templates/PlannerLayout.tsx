import { ProfileMenu } from '../organisms/ProfileMenu';
import { t } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Compass, Route } from 'lucide-react';
export function PlannerLayout({ children }: { children: ReactNode }) {
    useTranslation();
    return (
        <>
            <header className="app-header">
                <a
                    className="brand"
                    href="#/"
                >
                    <span>
                        <Route size={ 23 } />
                    </span>
                    {
                        t('brand.name')
                    }
                    <span className="brand-sub">
                        {
                            t('brand.tagline')
                        }
                    </span>
                </a>
                <div className="header-right">
                    <span className="header-active">
                        <Compass size={ 16 } />
                        {
                            t('brand.planner')
                        }
                    </span>
                    <ProfileMenu />
                </div>
            </header>
            <main>
                {
                    children
                }
            </main>
            <footer className="app-footer">
                <span>
                    {
                        t('brand.footer')
                    }
                </span>
                <span>
                    TRAVEL AT YOUR OWN PACE
                </span>
            </footer>
        </>
    );
}
