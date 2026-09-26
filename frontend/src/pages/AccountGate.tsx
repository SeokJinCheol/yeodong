import { LanguageSelect } from '../components/molecules/LanguageSelect';
import { t, translateMessage } from '../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useState, type ReactNode } from 'react';
import { api, configureAccount, json } from '../lib/api';
import { AccountContext, type Account, type AccountPreferences } from '../hooks/useAccount';
import { Button } from '../components/atoms/Button';

type Session = { user: Account; csrf: string };
export function AccountGate({ children }: { children: ReactNode }) {
    useTranslation();
    const [user, setUser] = useState<Account | null>(null);
    const [loading, setLoading] = useState(true);
    const [setup, setSetup] = useState(false);
    const [register, setRegister] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [setupToken, setSetupToken] = useState('');
    function accept(session: Session) {
        configureAccount(session.user.id, session.csrf, session.user.trips);
        setUser(session.user);
        setPassword('');
        setSetupToken('');
    }
    async function initialize() {
        setLoading(true);
        setError('');
        try {
            const state = await api<{ setup_required: boolean }>('/auth/status');
            setSetup(state.setup_required);
            setRegister(state.setup_required);
            try {
                accept(await api<Session>('/auth/me'));
            } catch (e) {
                if (!(e instanceof Error) || !('status' in e) || e.status !== 401) throw e;
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void initialize();
        const expired = () => {
            configureAccount(null, '', []);
            setUser(null);
            setError(t('auth.error.expired'));
        };
        window.addEventListener('account-expired', expired);
        return () => window.removeEventListener('account-expired', expired);
    }, []);
    async function submit() {
        setBusy(true);
        setError('');
        try {
            await api<Session>(
                register ? '/auth/register' : '/auth/login',
                json('POST', {
                    username,
                    password,
                    ...(register ? { display_name: displayName, setup_token: setupToken } : {}),
                }),
            );
            window.location.reload();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    async function logout() {
        await api('/auth/logout', json('POST', {}));
        configureAccount(null, '', []);
        setUser(null);
        setPassword('');
        window.location.reload();
    }
    async function savePreferences(value: AccountPreferences) {
        const saved = await api<AccountPreferences>('/auth/preferences', json('PATCH', value));
        setUser((previous) => (previous ? { ...previous, preferences: saved } : null));
    }
    if (loading)
        return (
            <main className="account-screen">
                <p role="status">
                    {
                        t('auth.status.loading')
                    }
                </p>
            </main>
        );
    if (user)
        return (
            <AccountContext.Provider value={ { user, savePreferences, logout } }>
                <div key={ user.id }>
                    {
                        children
                    }
                </div>
            </AccountContext.Provider>
        );
    return (
        <main className="account-screen">
            <form
                className="account-card"
                onSubmit={ (e) => {
                    e.preventDefault();
                    void submit();
                } }
            >
                <LanguageSelect />
                <p className="eyebrow">
                    {
                        t('brand.pageTitle')
                    }
                </p>
                <h1>
                    {
                        setup
                            ? t('auth.title.setup')
                            : register
                                ? t('auth.title.register')
                                : t('auth.button.login')
                    }
                </h1>
                <p>
                    {
                        t('auth.privacyNotice')
                    }
                </p>
                {
                    error && (
                        <p
                            role="alert"
                            className="error"
                        >
                            {
                                translateMessage(error)
                            }
                        </p>
                    )
                }
                <label>
                    {
                        t('auth.form.username')
                    }
                    <input
                        required
                        autoComplete="username"
                        minLength={ 3 }
                        maxLength={ 40 }
                        pattern="[a-zA-Z0-9_.\-]+"
                        value={ username }
                        onChange={ (e) => setUsername(e.target.value) }
                        placeholder={ t('auth.form.usernamePlaceholder') }
                    />
                </label>
                {
                    register && (
                        <label>
                            {
                                t('auth.form.displayName')
                            }
                            <input
                                required
                                autoComplete="nickname"
                                maxLength={ 60 }
                                value={ displayName }
                                onChange={ (e) => setDisplayName(e.target.value) }
                            />
                        </label>
                    )
                }
                <label>
                    {
                        t('auth.form.password')
                    }
                    <input
                        required
                        type="password"
                        autoComplete={ register ? 'new-password' : 'current-password' }
                        minLength={ 12 }
                        maxLength={ 128 }
                        value={ password }
                        onChange={ (e) => setPassword(e.target.value) }
                        placeholder={ t('auth.form.passwordPlaceholder') }
                    />
                </label>
                {
                    setup && (
                        <>
                            <label>
                                {
                                    t('auth.form.setupCode')
                                }
                                <input
                                    required
                                    type="password"
                                    autoComplete="off"
                                    value={ setupToken }
                                    onChange={ (e) => setSetupToken(e.target.value) }
                                />
                            </label>
                            <p className="small muted">
                                {
                                    t('auth.form.setupHint')
                                }
                            </p>
                        </>
                    )
                }
                <Button disabled={ busy }>
                    {
                        busy
                            ? t('common.status.checking')
                            : register
                                ? t('auth.button.createAccount')
                                : t('auth.button.login')
                    }
                </Button>
                {
                    !setup && (
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={ busy }
                            onClick={ () => {
                                setRegister(!register);
                                setError('');
                                setPassword('');
                            } }
                        >
                            {
                                register ? t('auth.button.backToLogin') : t('auth.button.newAccount')
                            }
                        </Button>
                    )
                }
                {
                    error && (
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={ busy }
                            onClick={ () => void initialize() }
                        >
                            {
                                t('common.button.reconnect')
                            }
                        </Button>
                    )
                }
            </form>
        </main>
    );
}
