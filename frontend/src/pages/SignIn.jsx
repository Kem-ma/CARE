import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { confirmSignUp, resendCode, signIn, signUp } from '../lib/auth';
import { errorText, keyedError } from '../lib/errors';

// Only ever send people back to a page inside this app
function safeNext(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export default function SignIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const { t } = useI18n();
  const next = safeNext(params.get('next'));

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null); // { key, params }, kept as a key so it re-translates

  async function finishSignIn() {
    const outcome = await signIn('citizen', email, password);
    if (outcome.status !== 'ok') throw keyedError('Extra step needed', 'auth.extraStep');
    await refresh();
    navigate(next, { replace: true });
  }

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      if (err.code === 'UserNotConfirmedException') {
        setMode('verify');
        setNote({ key: 'auth.notConfirmed' });
        resendCode(email).catch(() => {});
      } else {
        setError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  const onSignIn = (event) => {
    event.preventDefault();
    run(finishSignIn);
  };

  const onSignUp = (event) => {
    event.preventDefault();
    run(async () => {
      await signUp(email, password);
      setNote({ key: 'auth.sentTo', params: { email: email.trim() } });
      setMode('verify');
    });
  };

  const onVerify = (event) => {
    event.preventDefault();
    run(async () => {
      await confirmSignUp(email, code);
      await finishSignIn();
    });
  };

  const onResend = () =>
    run(async () => {
      await resendCode(email);
      setNote({ key: 'auth.newCodeSent' });
    });

  const switchTo = (target) => {
    setMode(target);
    setError(null);
    setNote(null);
  };

  const heading = { signin: 'auth.signin', signup: 'auth.signup', verify: 'auth.verify' }[mode];

  return (
    <div className="auth">
      <h1>{t(heading)}</h1>
      <p className="sub">{mode === 'verify' ? t('auth.verifySub') : t('auth.sub')}</p>

      {error && <p className="errors" role="alert">{errorText(error, t)}</p>}
      {note && <p className="callout info" role="status">{t(note.key, note.params)}</p>}

      {mode === 'verify' ? (
        <form onSubmit={onVerify}>
          <div className="field">
            <label htmlFor="code">{t('auth.code')}</label>
            <input id="code" className="inp mono" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <button className="btn primary wide" disabled={busy}>{busy ? t('auth.confirming') : t('auth.confirmBtn')}</button>
          <p className="auth-switch">{t('auth.didntGet')} <button type="button" onClick={onResend}>{t('auth.resend')}</button></p>
        </form>
      ) : (
        <form onSubmit={mode === 'signup' ? onSignUp : onSignIn}>
          <div className="field">
            <label htmlFor="email">{t('auth.email')}</label>
            <input id="email" type="email" className="inp" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">{t('auth.password')}</label>
            <input id="password" type="password" className="inp" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
            {mode === 'signup' && <div className="hint">{t('auth.passwordHint')}</div>}
          </div>
          <button className="btn primary wide" disabled={busy}>
            {busy ? t('auth.wait') : mode === 'signup' ? t('auth.createBtn') : t('auth.signin')}
          </button>
          <p className="auth-switch">
            {mode === 'signup' ? (
              <>{t('auth.haveAccount')} <button type="button" onClick={() => switchTo('signin')}>{t('auth.signin')}</button></>
            ) : (
              <>{t('auth.newHere')} <button type="button" onClick={() => switchTo('signup')}>{t('auth.signup')}</button></>
            )}
          </p>
        </form>
      )}
    </div>
  );
}
