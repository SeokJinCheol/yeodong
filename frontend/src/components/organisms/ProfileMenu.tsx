import { useEffect, useId, useRef, useState } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../../hooks/useAccount';
import { t, translateMessage } from '../../lib/i18n';

export function ProfileMenu() {
    useTranslation();
    const { user, logout } = useAccount();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const firstLink = useRef<HTMLAnchorElement>(null);
    const panelId = useId();

    useEffect(() => {
        if (!open) return;
        firstLink.current?.focus();
        const onPointerDown = (event: PointerEvent) => {
            if (!container.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
                trigger.current?.focus();
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    async function signOut() {
        setBusy(true);
        setError('');
        try {
            await logout();
        } catch (e) {
            setError((e as Error).message);
            setOpen(true);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div
            className="profile-menu"
            ref={ container }
            onBlur={ (event) => {
                if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
                    setOpen(false);
            } }
        >
            <button
                type="button"
                className="profile-trigger"
                ref={ trigger }
                aria-label={ t('account.profile.label', { name: user.display_name }) }
                aria-expanded={ open }
                aria-controls={ panelId }
                onClick={ () => setOpen((previous) => !previous) }
            >
                {
                    Array.from(user.display_name.trim() || user.username)[0].toUpperCase()
                }
            </button>
            {
                open && (
                    <div
                        className="profile-popover"
                        id={ panelId }
                    >
                        <div className="profile-identity">
                            <strong>
                                {
                                    user.display_name
                                }
                            </strong>
                            <span>
                                @
                                {
                                    user.username
                                }
                            </span>
                        </div>
                        <nav aria-label={ t('account.profile.menu') }>
                            <a
                                ref={ firstLink }
                                href="#/settings"
                                onClick={ () => {
                                    setOpen(false);
                                    trigger.current?.focus();
                                } }
                            >
                                <Settings
                                    size={ 17 }
                                    aria-hidden="true"
                                />
                                {
                                    t('settings.page.title')
                                }
                            </a>
                            <button
                                type="button"
                                disabled={ busy }
                                onClick={ () => void signOut() }
                            >
                                <LogOut
                                    size={ 17 }
                                    aria-hidden="true"
                                />
                                {
                                    t(busy ? 'common.status.working' : 'auth.button.logout')
                                }
                            </button>
                        </nav>
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
                    </div>
                )
            }
        </div>
    );
}
