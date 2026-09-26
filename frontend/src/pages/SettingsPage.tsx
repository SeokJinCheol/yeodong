import { ArrowLeft, Globe, Settings, Luggage } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AccountPanel } from '../components/organisms/AccountPanel';
import { TripTools } from '../components/organisms/TripTools';
import { LanguageSelect } from '../components/molecules/LanguageSelect';
import { t, translateMessage } from '../lib/i18n';
import type { TrashItem } from '../lib/types';

export function SettingsPage({
    busy,
    trash,
    onRestore,
    runMutation,
    error,
}: {
    busy: boolean;
    trash: TrashItem[];
    onRestore: (id: number) => Promise<void>;
    runMutation: (action: () => Promise<unknown>) => Promise<void>;
    error: string;
}) {
    useTranslation();
    return (
        <section
            className="settings-page"
            aria-labelledby="settings-title"
        >
            <a
                className="settings-back"
                href="#/"
            >
                <ArrowLeft
                    size={ 16 }
                    aria-hidden="true"
                />
                {
                    t('settings.page.back')
                }
            </a>
            <div className="settings-page-heading">
                <h1 id="settings-title">
                    {
                        t('settings.page.title')
                    }
                </h1>
                <p>
                    {
                        t('settings.page.description')
                    }
                </p>
            </div>
            {
                error && (
                    <p
                        className="error"
                        role="alert"
                    >
                        {
                            translateMessage(error)
                        }
                    </p>
                )
            }
            <section
                className="settings-card"
                aria-labelledby="language-settings-title"
            >
                <h2 id="language-settings-title">
                    <Globe
                        size={ 20 }
                        aria-hidden="true"
                    />
                    {
                        t('common.label.language')
                    }
                </h2>
                <LanguageSelect />
            </section>
            <section
                className="settings-card"
                aria-labelledby="account-settings-title"
            >
                <h2 id="account-settings-title">
                    <Settings
                        size={ 20 }
                        aria-hidden="true"
                    />
                    {
                        t('account.preferences.title')
                    }
                </h2>
                <AccountPanel />
            </section>
            <section
                className="settings-card"
                aria-labelledby="trip-settings-title"
            >
                <h2 id="trip-settings-title">
                    <Luggage
                        size={ 20 }
                        aria-hidden="true"
                    />
                    {
                        t('trip.tools.title')
                    }
                </h2>
                <TripTools
                    busy={ busy }
                    trash={ trash }
                    onRestore={ onRestore }
                    runMutation={ runMutation }
                />
            </section>
        </section>
    );
}
