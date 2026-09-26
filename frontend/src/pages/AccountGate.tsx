import { useEffect, useState, type ReactNode } from 'react';
import { api, configureAccount, json } from '../lib/api';
import { AccountContext, type Account, type AccountPreferences } from '../hooks/useAccount';
import { Button } from '../components/atoms/Button';

type Session = { user: Account; csrf: string };
export function AccountGate({ children }: { children: ReactNode }) {
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
            setError('로그인이 만료되었거나 다른 계정으로 변경되었습니다. 다시 로그인해 주세요.');
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
                    로그인 확인 중…
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
                <p className="eyebrow">
                    여동 · 나만의 여행
                </p>
                <h1>
                    {
                        setup ? '첫 계정 만들기' : register ? '회원가입' : '로그인'
                    }
                </h1>
                <p>
                    여행과 일정은 로그인한 계정에만 저장됩니다.
                </p>
                {
                    error && (
                        <p
                            role="alert"
                            className="error"
                        >
                            {
                                error
                            }
                        </p>
                    )
                }
                <label>
                    아이디
                    <input
                        required
                        autoComplete="username"
                        minLength={ 3 }
                        maxLength={ 40 }
                        pattern="[a-zA-Z0-9_.\-]+"
                        value={ username }
                        onChange={ (e) => setUsername(e.target.value) }
                        placeholder="영문·숫자·점·밑줄·하이픈 3~40자"
                    />
                </label>
                {
                    register && (
                        <label>
                            표시 이름
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
                    비밀번호
                    <input
                        required
                        type="password"
                        autoComplete={ register ? 'new-password' : 'current-password' }
                        minLength={ 12 }
                        maxLength={ 128 }
                        value={ password }
                        onChange={ (e) => setPassword(e.target.value) }
                        placeholder="12자 이상"
                    />
                </label>
                {
                    setup && (
                        <>
                            <label>
                                초기 설정 코드
                                <input
                                    required
                                    type="password"
                                    autoComplete="off"
                                    value={ setupToken }
                                    onChange={ (e) => setSetupToken(e.target.value) }
                                />
                            </label>
                            <p className="small muted">
                                서버 관리자에게 받은 초기 설정 코드를 입력하세요. 기존 여행은 이 계정에
                                연결됩니다.
                            </p>
                        </>
                    )
                }
                <Button disabled={ busy }>
                    {
                        busy ? '확인 중…' : register ? '계정 만들기' : '로그인'
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
                                register ? '로그인으로 돌아가기' : '새 계정 만들기'
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
                            다시 연결
                        </Button>
                    )
                }
            </form>
        </main>
    );
}
