import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Callout, StatusPill } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useDraft } from '../context/DraftContext';
import { mmss, useCountdown } from '../hooks/useCountdown';
import { typeName, useI18n } from '../i18n';
import { amendReport, ownReport } from '../lib/api';
import { errorText } from '../lib/errors';
import { formatTime } from '../lib/incidents';

const PHONE = /^[+0-9 ()-]{6,30}$/;

function EditForm({ view, busy, onSave }) {
  const { t } = useI18n();
  const [city, setCity] = useState(view.incidentLocation?.city || '');
  const [quarter, setQuarter] = useState(view.incidentLocation?.quarter || '');
  const [text, setText] = useState(view.descriptionText || '');
  const [guardian, setGuardian] = useState(view.guardianContact || '');
  const [problems, setProblems] = useState([]);

  function submit(event) {
    event.preventDefault();
    const found = [];
    if (!city.trim()) found.push('v.city');
    if (!quarter.trim()) found.push('v.quarter');
    if (view.descriptionType === 'TEXT' && !text.trim()) found.push('v.text');
    if (view.guardianContact && !PHONE.test(guardian.trim())) found.push('v.guardian');
    setProblems(found);
    if (found.length) return;

    const change = { action: 'edit', incidentLocation: { city: city.trim(), quarter: quarter.trim() } };
    if (view.descriptionType === 'TEXT') change.descriptionText = text.trim();
    if (view.guardianContact) change.guardianContact = guardian.trim();
    onSave(change);
  }

  return (
    <form onSubmit={submit} noValidate>
      {problems.length > 0 && (
        <div className="errors" role="alert">
          <b>{t('form.fixTitle')}</b>
          <ul>{problems.map((key) => <li key={key}>{t(key)}</li>)}</ul>
        </div>
      )}
      {view.guardianContact && (
        <div className="field">
          <label htmlFor="guardian">{t('form.guardian')}</label>
          <input id="guardian" className="inp mono" inputMode="tel" maxLength={30} value={guardian} onChange={(e) => setGuardian(e.target.value)} />
        </div>
      )}
      <div className="field">
        <span className="lbl">{t('form.where')}</span>
        <div className="two">
          <input className="inp" aria-label={t('form.city')} maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} />
          <input className="inp" aria-label={t('form.quarter')} maxLength={100} value={quarter} onChange={(e) => setQuarter(e.target.value)} />
        </div>
      </div>
      {view.descriptionType === 'TEXT' ? (
        <div className="field">
          <label htmlFor="desc">{t('form.desc')}</label>
          <textarea id="desc" className="inp" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      ) : (
        <p className="fine">{t('manage.voiceNote')}</p>
      )}
      <div className="actions">
        <button className="btn primary" disabled={busy}>{busy ? t('auth.wait') : t('manage.save')}</button>
      </div>
    </form>
  );
}

export default function ManageReport() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const { recent, setRecent } = useDraft();
  const { t, lang } = useI18n();

  // Just sent from this page visit: an anonymous report can only be changed from here, with its edit token.
  const local = recent?.reportId === id ? recent : null;
  const editToken = local?.editToken || null;

  const [view, setView] = useState(local?.view || null);
  const [deadline, setDeadline] = useState(local?.deadline || null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null); // translation key of the last success message
  const [addition, setAddition] = useState('');
  const [reason, setReason] = useState('');
  const secondsLeft = useCountdown(deadline);

  const apply = useCallback((next) => {
    const nextDeadline = Date.now() + next.secondsLeft * 1000;
    setView(next);
    setDeadline(nextDeadline);
    if (local) setRecent({ ...local, view: next, deadline: nextDeadline });
  }, [local, setRecent]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      apply(await ownReport(id));
    } catch (err) {
      setLoadError(err);
    }
  }, [id, apply]);

  // A signed-in reporter always gets the current version from the server
  useEffect(() => {
    if (!loading && user && !editToken) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, editToken, id]);

  async function change(body, successKey) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      apply(await amendReport(id, body, editToken));
      setSaved(successKey);
      return true;
    } catch (err) {
      setError(err);
      if (err.key === 'err.amendClosed') {
        if (user && !editToken) load();
        else setView((v) => ({ ...v, canEdit: false, ...(body.action === 'add' ? { canAdd: false } : {}) }));
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(event) {
    event.preventDefault();
    if (!addition.trim()) return;
    if (await change({ action: 'add', text: addition.trim() }, 'manage.added')) setAddition('');
  }

  function withdraw() {
    if (!window.confirm(t('manage.confirmWithdraw'))) return;
    change({ action: 'withdraw', reason: reason.trim() || null }, 'manage.withdrawn');
  }

  if (loading) return <div className="page"><p className="state" role="status">{t('common.loading')}</p></div>;

  if (!view) {
    return (
      <div className="page">
        <h1>{t('manage.title')}</h1>
        {loadError ? (
          <p className="errors" role="alert">{errorText(loadError, t)}</p>
        ) : user ? (
          <p className="state" role="status">{t('common.loading')}</p>
        ) : (
          <div className="gate">
            <h2>{t('manage.gateTitle')}</h2>
            <p>{t('manage.gateText')}</p>
            <Link className="btn primary" to={`/sign-in?next=${encodeURIComponent(`/report/manage/${id}`)}`}>{t('nav.signIn')}</Link>
          </div>
        )}
      </div>
    );
  }

  const open = secondsLeft > 0;
  const canEdit = open && view.canEdit;
  const canAdd = open && view.canAdd;

  return (
    <div className="page">
      <h1>{t('manage.title')}</h1>
      {view.status !== 'WITHDRAWN' && (
        <p className="sub">
          {open && (canEdit || canAdd)
            ? <>{t('manage.timeLeft')} <span className="countdown">{mmss(secondsLeft)}</span></>
            : t('manage.closed')}
        </p>
      )}

      <div className="card">
        <div className="row"><span className="k">{t('prev.type')}</span><span className="v">{typeName(t, view.incidentType)}</span></div>
        <div className="row"><span className="k">{t('dash.status')}</span><span className="v"><StatusPill status={view.status} /></span></div>
        <div className="row"><span className="k">{t('dash.submitted')}</span><span className="v">{formatTime(view.createdAt, lang)}</span></div>
        {view.trackingRef && (
          <div className="row"><span className="k">{t('lookup.aria')}</span><span className="v mono">{view.trackingRef}</span></div>
        )}
      </div>

      {error && <div style={{ marginTop: 16 }}><Callout tone="warn">{errorText(error, t)}</Callout></div>}
      {saved && <div style={{ marginTop: 16 }}><Callout tone="good">{t(saved)}</Callout></div>}

      {view.status === 'WITHDRAWN' && (
        <div className="amend">
          <h2>{t('manage.withdrawnTitle')}</h2>
          <p className="fine">{t('manage.withdrawnText')}</p>
        </div>
      )}

      {canEdit && (
        <section className="amend">
          <h2>{t('manage.editTitle')}</h2>
          <p className="fine">{t('manage.editNote')}</p>
          <EditForm key={`${view.reportId}-${view.descriptionText}-${view.incidentLocation?.quarter}`} view={view} busy={busy} onSave={(body) => change(body, 'manage.saved')} />
        </section>
      )}

      {(canAdd || view.additions.length > 0) && (
        <section className="amend">
          <h2>{canAdd ? t('manage.addTitle') : t('manage.addedTitle')}</h2>
          {canAdd && (
            <form onSubmit={add}>
              <p className="fine">{t('manage.addNote')}</p>
              <textarea className="inp" aria-label={t('manage.addTitle')} maxLength={1000} value={addition} onChange={(e) => setAddition(e.target.value)} />
              <div className="actions">
                <button className="btn primary" disabled={busy || !addition.trim()}>{t('manage.addBtn')}</button>
              </div>
            </form>
          )}
          {view.additions.length > 0 && (
            <ul className="additions">
              {view.additions.map((item) => (
                <li key={`${item.timestamp}-${item.text}`}>
                  <span className="meta">{formatTime(item.timestamp, lang)}</span>
                  {item.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canEdit && (
        <section className="amend">
          <h2>{t('manage.withdrawTitle')}</h2>
          <p className="fine">{t('manage.withdrawNote')}</p>
          <label className="lbl" htmlFor="reason">{t('manage.reason')}</label>
          <textarea id="reason" className="inp" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="actions">
            <button className="btn plain" disabled={busy} onClick={withdraw}>{t('manage.withdrawBtn')}</button>
          </div>
        </section>
      )}

      <div className="actions" style={{ marginTop: 24 }}>
        {user ? <Link className="btn plain" to="/my-reports">{t('nav.myReports')}</Link> : <Link className="btn plain" to="/">{t('track.home')}</Link>}
      </div>
    </div>
  );
}
