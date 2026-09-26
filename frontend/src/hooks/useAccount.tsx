import { createContext, useContext } from 'react';
import type { RoutePreferences, Trip } from '../lib/types';

export type AccountPreferences = Pick<RoutePreferences, 'departureTime' | 'timeZone' | 'mode'>;
export interface Account {
    id: number;
    username: string;
    display_name: string;
    preferences: AccountPreferences;
    trips: Trip[];
}
export const AccountContext = createContext<{
    user: Account;
    savePreferences: (value: AccountPreferences) => Promise<void>;
    logout: () => Promise<void>;
} | null>(null);
export function useAccount() {
    const account = useContext(AccountContext);
    if (!account) throw new Error('로그인이 필요합니다.');
    return account;
}
