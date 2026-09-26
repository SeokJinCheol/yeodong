import { t, translateMessage } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useAccount } from '../../hooks/useAccount';
import { Button } from '../atoms/Button';
import type { RoutePreferences } from '../../lib/types';

export function AccountPanel() {
    useTranslation();
    const account = useAccount();
    const [value, setValue] = useState(account.user.preferences);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    async function act(action: () => Promise<void>) {
        setBusy(true);
        setError('');
        setMessage('');
        try {
            await action();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <section
            className="account-panel"
            aria-label={ t('account.title') }
        >
            <form
                onSubmit={ (e) => {
                    e.preventDefault();
                    void act(async () => {
                        await account.savePreferences(value);
                        setMessage(t('account.preferences.saved'));
                    });
                } }
            >
                <p className="small muted">
                    {
                        t('account.preferences.description')
                    }
                </p>
                <label>
                    {
                        t('account.preferences.departureTime')
                    }
                    <input
                        type="time"
                        required
                        value={ value.departureTime }
                        onChange={ (e) => setValue({ ...value, departureTime: e.target.value }) }
                    />
                </label>
                <label>
                    {
                        t('account.preferences.timeZone')
                    }
                    <select
                        value={ value.timeZone }
                        onChange={ (e) => setValue({ ...value, timeZone: e.target.value }) }
                    >
                        <option value="Asia/Tokyo">
                            {
                                t('common.timeZone.tokyo')
                            }
                        </option>
                        <option value="Asia/Seoul">
                            {
                                t('common.timeZone.seoul')
                            }
                        </option>
                        <option value="Asia/Taipei">
                            {
                                t('common.timeZone.taipei')
                            }
                        </option>
                        <option value="Asia/Singapore">
                            {
                                t('common.timeZone.singapore')
                            }
                        </option>
                        <option value="Europe/Paris">
                            {
                                t('common.timeZone.paris')
                            }
                        </option>
                        <option value="Europe/London">
                            {
                                t('common.timeZone.london')
                            }
                        </option>
                        <option value="America/New_York">
                            {
                                t('common.timeZone.newYork')
                            }
                        </option>
                        <option value="America/Los_Angeles">
                            {
                                t('common.timeZone.losAngeles')
                            }
                        </option>
                    </select>
                </label>
                <label>
                    {
                        t('account.preferences.travelMode')
                    }
                    <select
                        value={ value.mode }
                        onChange={ (e) =>
                            setValue({
                                ...value,
                                mode: e.target.value as RoutePreferences['mode'],
                            })
                        }
                    >
                        <option value="MAP">
                            Map
                        </option>
                        <option value="WALK">
                            {
                                t('route.mode.walk')
                            }
                        </option>
                        <option value="DRIVE">
                            {
                                t('route.mode.drive')
                            }
                        </option>
                        <option value="TRANSIT">
                            {
                                t('route.mode.transit')
                            }
                        </option>
                    </select>
                </label>
                <Button disabled={ busy }>
                    {
                        t('account.preferences.save')
                    }
                </Button>
            </form>
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
            {
                message && <p role="status">
                    {
                        translateMessage(message)
                    }
                </p>
            }
        </section>
    );
}
