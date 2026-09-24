import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LanguageSwitch from '../../components/LanguageSwitch';
import { isAdminConfigured } from '../../config';
import { useI18n } from '../../i18n';
import { completeNewPassword, signIn, submitTotp } from '../../lib/auth';
import { errorText } from '../../lib/errors';

const TITLES = { signin: 'admin.signinTitle', 'new-password': 'admin.newPasswordTitle', totp: 'admin.totpTitle' };
const SUBS = { signin: 'admin.signinSub', 'new-password': 'admin.newPasswordSub', totp: 'admin.totpSub' };

export default function AdminSignIn() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState('signin'); // 'signin' | 'new-password' | 'totp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pending = useRef(null); // the Cognito user waiting on a challenge

  function handle(outcome) {
    if (outcome.status === 'ok') {
      navigate('/admin', { replace: true });
      return;
    }
    pending.current = outcome.user;
    setStep(outcome.status);
  }

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      handle(await action());
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="shead">
        <Link to="/" className="brand"><span className="mark">C</span><b>C.A.R.E</b></Link>
        <LanguageSwitch />
      </header>
      <main className="auth">
        <h1>{t(TITLES[step])}</h1>
        <p className="sub">{t(SUBS[step])}</p>

        {!isAdminConfigured && (
          <p className="errors" role="alert">
            The admin site is not connected to its server yet. Fill in <code>frontend/.env.local</code>, including
            the WebSocket URL and the admin pool values.
          </p>
        )}
        {error && <p className="errors" role="alert">{errorText(error, t)}</p>}

        {step === 'signin' && (
          <form onSubmit={(e) => { e.preventDefault(); run(() => signIn('admin', email, password)); }}>
            <div className="field">
              <label htmlFor="email">{t('auth.email')}</label>
              <input id="email" type="email" className="inp" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">{t('auth.password')}</label>
              <input id="password" type="password" className="inp" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn primary wide" disabled={busy || !isAdminConfigured}>{busy ? t('admin.signingIn') : t('auth.signin')}</button>
          </form>
        )}

        {step === 'new-password' && (
          <form onSubmit={(e) => { e.preventDefault(); run(() => completeNewPassword(pending.current, newPassword)); }}>
            <div className="field">
              <label htmlFor="new">{t('admin.newPassword')}</label>
              <input id="new" type="password" className="inp" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              <div className="hint">{t('admin.newPasswordHint')}</div>
            </div>
            <button className="btn primary wide" disabled={busy}>{busy ? t('admin.saving') : t('admin.setBtn')}</button>
          </form>
        )}

        {step === 'totp' && (
          <form onSubmit={(e) => { e.preventDefault(); run(() => submitTotp(pending.current, code)); }}>
            <div className="field">
              <label htmlFor="code">{t('admin.totpLabel')}</label>
              <input id="code" className="inp mono" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <button className="btn primary wide" disabled={busy}>{busy ? t('admin.checking') : t('admin.verify')}</button>
          </form>
        )}
      </main>
    </div>
  );
}
