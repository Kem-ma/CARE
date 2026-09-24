import { useI18n } from '../i18n';

// English / Français. Shown on every page, including the staff pages.
export default function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="langsw" role="group" aria-label={t('lang.label')}>
      <button type="button" aria-pressed={lang === 'en'} lang="en" onClick={() => setLang('en')}>EN</button>
      <button type="button" aria-pressed={lang === 'fr'} lang="fr" onClick={() => setLang('fr')}>FR</button>
    </div>
  );
}
