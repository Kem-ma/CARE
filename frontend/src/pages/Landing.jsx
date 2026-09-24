import { Link, useNavigate } from 'react-router-dom';
import { EMERGENCY_NUMBER } from '../config';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <>
      <section className="hero">
        <div>
          <h1>{t('landing.title')}</h1>
          <p className="lede">{t('landing.lede')}</p>
          <div className="cta-row">
            <button className="btn primary" onClick={() => navigate('/report/location')}>
              {t('landing.report')}
            </button>
            <button className="btn secondary" onClick={() => navigate('/my-reports')}>
              {t('landing.viewMine')}
            </button>
          </div>
          {!user && (
            <p className="signin-hint">
              {t('landing.hint1')} <Link to="/sign-in">{t('nav.signIn')}</Link> {t('landing.hint2')}
            </p>
          )}
        </div>
        <aside className="emergency">
          <div className="k">{t('landing.emergencyTitle')}</div>
          <div className="big">{t('landing.call', { n: EMERGENCY_NUMBER })}</div>
          <p>{t('landing.emergencyText')}</p>
        </aside>
      </section>

      <section className="how" id="how">
        <div className="how-inner">
          <h2>{t('how.title')}</h2>
          <ol className="steps">
            {[1, 2, 3, 4].map((n) => (
              <li key={n}>
                <h3>{t(`how.${n}.t`)}</h3>
                <p>{t(`how.${n}.d`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
