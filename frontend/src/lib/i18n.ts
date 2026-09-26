import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from '../locales/ko.json';
import en from '../locales/en.json';

export type Language = 'ko' | 'en';
export const languageStorageKey = 'yeodong-language';
export function resolveLanguage(
    saved: string | null,
    browserLanguages: readonly string[],
): Language {
    if (saved === 'ko' || saved === 'en') return saved;
    for (const language of browserLanguages) {
        const base = language.toLowerCase().split('-')[0];
        if (base === 'ko' || base === 'en') return base;
    }
    return 'ko';
}
function initialLanguage(): Language {
    let saved: string | null = null;
    try {
        saved = localStorage.getItem(languageStorageKey);
    } catch {
        // Language switching still works when browser storage is unavailable.
    }
    return resolveLanguage(saved, typeof navigator === 'undefined' ? [] : navigator.languages);
}
void i18n.use(initReactI18next).init({
    resources: { ko: { translation: ko }, en: { translation: en } },
    lng: initialLanguage(),
    fallbackLng: 'ko',
    supportedLngs: ['ko', 'en'],
    keySeparator: '.',
    nsSeparator: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
});

export function locale() {
    return i18n.resolvedLanguage === 'en' ? 'en-US' : 'ko-KR';
}
// Resolve the current language at call time, including long-lived map callbacks.
type LeafKeys<T> = {
    [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafKeys<T[K]>}`;
}[keyof T & string];
export type TranslationKey = LeafKeys<typeof ko>;

export const t = (key: TranslationKey, values?: Record<string, unknown>): string =>
    i18n.t(key, values ?? {});
function updateDocument() {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = i18n.resolvedLanguage ?? 'ko';
    document.title = t('brand.pageTitle');
}
i18n.on('languageChanged', updateDocument);
updateDocument();
export async function changeLanguage(language: Language) {
    await i18n.changeLanguage(language);
    try {
        localStorage.setItem(languageStorageKey, language);
    } catch {
        // Preserve the in-memory choice when storage is disabled or full.
    }
}
export default i18n;

// Translate system messages only. User-authored names and notes never pass through this helper.
function messageEntries(
    resources: Record<string, unknown>,
    prefix = '',
): [TranslationKey, string][] {
    return Object.entries(resources).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof value === 'string'
            ? [[path as TranslationKey, value]]
            : messageEntries(value as Record<string, unknown>, path);
    });
}
const messageKeys = new Map(
    [...messageEntries(ko), ...messageEntries(en)]
        .filter(
            ([key]) =>
                key.includes('.error.') ||
                key === 'backup.imported' ||
                key === 'account.preferences.saved',
        )
        .map(([key, value]) => [value, key]),
);
export function translateMessage(message: string): string {
    const late = message.match(/^(.*): 필수 (\d{2}:\d{2})보다 (\d+)분 늦게 도착합니다\.$/);
    if (late) return t('schedule.late', { name: late[1], time: late[2], minutes: late[3] });
    const order = message.match(
        /^이 일정의 중간 방문지는 (\d+)개입니다\. 필수 순서는 1~\d+ 안에서 지정해 주세요\.$/,
    );
    if (order) return t('schedule.orderRange', { count: Number(order[1]) });
    const key = messageKeys.get(message);
    return key ? t(key) : message;
}
