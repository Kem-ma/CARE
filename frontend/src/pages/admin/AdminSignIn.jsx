import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LanguageSwitch from '../../components/LanguageSwitch';
import { isAdminConfigured } from '../../config';
import { useI18n } from '../../i18n';
import { completeNewPassword, confirmNewPassword, forgotPassword, signIn, submitTotp } from '../../lib/auth';
import { errorText, keyedError } from '../../lib/errors';
import { PasswordInput } from '../../components/ui';

const TITLES = {
  signin: 'admin.signinTitle', 'new-password': 'admin.newPasswordTitle', totp: 'admin.totpTitle',
  forgot: 'auth.forgotTitle', reset: 'auth.resetTitle',
};
const SUBS = {
  signin: 'admin.signinSub', 'new-password': 'admin.newPasswordSub', totp: 'admin.totpSub',
  forgot: 'admin.forgotSub', reset: 'auth.resetSub',
};

// Errors that would reveal whether a staff account exists for an address. A reset request
// answers the same way either way.
const HIDE_ON_RESET = new Set(['UserNotFoundException', 'InvalidParameterException']);

export default function AdminSignIn() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState('signin'); // 'signin' | 'new-password' | 'totp' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null); // { key, params }, kept as a key so it re-translates
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
    setNote(null);
    try {
      handle(await action());
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const goTo = (target) => {
    setStep(target);
    setError(null);
    setNote(null);
    setCode('');
    setNewPassword('');
    setConfirm('');
  };

  // Forgotten password: Cognito emails a code to the staff member's verified address
  const sendResetCode = () =>
    run(async () => {
      try {
        await forgotPassword(email, 'admin');
      } catch (err) {
        if (!HIDE_ON_RESET.has(err.code)) throw err;
      }
      goTo('reset');
      setNote({ key: 'auth.resetSent', params: { email: email.trim() } });
      return { status: 'reset' };
    });

  const newPasswordFields = (
    <>
      <div className="field">
        <label htmlFor="new">{t('admin.newPassword')}</label>
        <PasswordInput id="new" autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
        <div className="hint">{t('admin.newPasswordHint')}</div>
      </div>
      <div className="field">
        <label htmlFor="confirm">{t('auth.confirmPassword')}</label>
        <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        {confirm !== '' && confirm !== newPassword && <div className="hint bad" role="alert">{t('auth.mismatch')}</div>}
      </div>
    </>
  );
  const checkMatch = () => {
    if (confirm !== newPassword) throw keyedError('Passwords do not match', 'auth.mismatch');
  };

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
        {note && <p className="callout info" role="status">{t(note.key, note.params)}</p>}

        {step === 'signin' && (
          <form onSubmit={(e) => { e.preventDefault(); run(() => signIn('admin', email, password)); }}>
            <div className="field">
              <label htmlFor="email">{t('auth.email')}</label>
              <input id="email" type="email" className="inp" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">{t('auth.password')}</label>
              <PasswordInput id="password" autoComplete="current-password" value={password} onChange={setPassword} />
              <div className="hint">
                <button type="button" className="text-btn" onClick={() => goTo('forgot')}>{t('auth.forgot')}</button>
              </div>
            </div>
            <button className="btn primary wide" disabled={busy || !isAdminConfigured}>{busy ? t('admin.signingIn') : t('auth.signin')}</button>
          </form>
        )}

        {step === 'new-password' && (
          <form onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              checkMatch();
              return completeNewPassword(pending.current, newPassword);
            });
          }}>
            {newPasswordFields}
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

        {step === 'forgot' && (
          <form onSubmit={(e) => { e.preventDefault(); sendResetCode(); }}>
            <div className="field">
              <label htmlFor="email">{t('auth.email')}</label>
              <input id="email" type="email" className="inp" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className="btn primary wide" disabled={busy || !isAdminConfigured}>{busy ? t('auth.wait') : t('auth.sendResetBtn')}</button>
            <p className="auth-switch">
              {t('auth.remembered')} <button type="button" onClick={() => goTo('signin')}>{t('auth.signin')}</button>
            </p>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              checkMatch();
              await confirmNewPassword(email, code, newPassword, 'admin');
              // Signed in with the new password; an authenticator code may still be asked for
              return signIn('admin', email, newPassword);
            });
          }}>
            <div className="field">
              <label htmlFor="code">{t('auth.resetCode')}</label>
              <input id="code" className="inp mono" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            {newPasswordFields}
            <button className="btn primary wide" disabled={busy}>{busy ? t('auth.wait') : t('auth.resetBtn')}</button>
            <p className="auth-switch">
              {t('auth.didntGet')} <button type="button" onClick={sendResetCode}>{t('auth.resend')}</button>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
