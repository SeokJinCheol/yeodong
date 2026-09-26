import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { t, changeLanguage, type Language } from '../../lib/i18n';

export function LanguageSelect() {
    const { i18n } = useTranslation();
    return (
        <label className="language-select">
            <Languages
                size={ 16 }
                aria-hidden="true"
            />
            <span>
                {
                    t('common.label.language')
                }
            </span>
            <select
                aria-label={ t('common.label.language') }
                value={ i18n.resolvedLanguage ?? 'ko' }
                onChange={ (event) => void changeLanguage(event.target.value as Language) }
            >
                <option
                    value="ko"
                    lang="ko"
                >
                    한국어
                </option>
                <option
                    value="en"
                    lang="en"
                >
                    English
                </option>
            </select>
        </label>
    );
}
