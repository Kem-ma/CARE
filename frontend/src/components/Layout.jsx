import { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { isConfigured } from '../config';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import LanguageSwitch from './LanguageSwitch';

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  function goToHow() {
    navigate('/');
    setTimeout(() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }), 60);
  }

  return (
    <div className="app">
      {!isConfigured && (
        <div className="config-banner" role="status">
          This site is not connected to its server yet. Copy <code>.env.example</code> to{' '}
          <code>.env.local</code> and fill in the values printed by <code>cdk deploy</code>.
        </div>
      )}
      <header className="shead">
        <Link to="/" className="brand" aria-label="C.A.R.E">
          <span className="mark">C</span>
          <b>C.A.R.E</b>
        </Link>
        <nav className="nav" aria-label={t('nav.main')}>
          <button className="lnk" onClick={goToHow}>{t('nav.how')}</button>
          <Link className="lnk" to="/my-reports">{t('nav.myReports')}</Link>
          <LanguageSwitch />
          {user ? (
            <div className="user">
              <span className="avatar" aria-hidden="true">{user.email.slice(0, 2)}</span>
              <span>{user.email}</span>
              <button className="btn small plain" onClick={logout}>{t('nav.signOut')}</button>
            </div>
          ) : (
            <Link className="btn small secondary" to="/sign-in">{t('nav.signIn')}</Link>
          )}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="sfoot">
        <span>C.A.R.E</span>
        <Link to="/admin/sign-in">{t('footer.staff')}</Link>
      </footer>
    </div>
  );
}
