import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckIcon, InfoIcon } from '../components/icons';
import { Callout } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useDraft } from '../context/DraftContext';
import { typeName, useI18n } from '../i18n';
import { submitReport, uploadEvidence } from '../lib/api';
import { errorText } from '../lib/errors';
import { NEEDS_GUARDIAN } from '../lib/incidents';
import { getLocation } from '../lib/location';

// phase: 'review' | 'sending' | 'uploading' | 'upload-failed' | 'done'
export default function Preview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { draft, update, reset } = useDraft();
  const { t } = useI18n();
  const [phase, setPhase] = useState('review');
  const [error, setError] = useState(null); // kept as an error object so it re-translates
  const [result, setResult] = useState(null);
  const [uploads, setUploads] = useState({});
  const [copied, setCopied] = useState(false);
  const evidence = useRef(null); // the files to upload, kept apart from the draft so a retry still has them

  // Nothing to review (for example after a page refresh): back to the form
  useEffect(() => {
    if (phase === 'review' && !result && (!draft.type || !draft.photo)) navigate('/report', { replace: true });
  }, [phase, result, draft.type, draft.photo, navigate]);

  async function sendEvidence(created) {
    setPhase('uploading');
    const jobs = [];
    if (uploads.photo !== 'done') {
      jobs.push(['photo', uploadEvidence(created.photoUpload, evidence.current.photo, 'image/jpeg')]);
    }
    if (created.audioUpload && uploads.audio !== 'done') {
      jobs.push(['audio', uploadEvidence(created.audioUpload, evidence.current.audio.blob, evidence.current.audio.mime)]);
    }
    const settled = await Promise.allSettled(jobs.map(([, job]) => job));
    const next = { ...uploads };
    let firstError = null;
    settled.forEach((outcome, index) => {
      next[jobs[index][0]] = outcome.status === 'fulfilled' ? 'done' : 'failed';
      if (outcome.status === 'rejected') firstError = firstError || outcome.reason;
    });
    setUploads(next);

    if (firstError) {
      setError(firstError);
      setPhase('upload-failed');
      return;
    }
    setError(null);
    setPhase('done');
    reset(); // the report is on its way; don't leave a copy around to be sent twice
  }

  async function submit() {
    setError(null);
    setPhase('sending');

    // A fresh reading now that the form is finished; keep the earlier one if this fails.
    let reading = draft.reading;
    if (draft.locState === 'granted') {
      try {
        reading = await getLocation();
        update({ reading });
      } catch {
        // keep the earlier reading
      }
    }

    evidence.current = {
      photo: draft.photo.blob,
      audio: draft.descType === 'voice' ? draft.audio : null,
    };

    const body = {
      incidentType: draft.type,
      descriptionType: draft.descType === 'voice' ? 'VOICE' : 'TEXT',
      ...(draft.descType === 'text' ? { descriptionText: draft.text.trim() } : {}),
      incidentLocation: { city: draft.city.trim(), quarter: draft.quarter.trim() },
      hasPhoto: true,
      ...(NEEDS_GUARDIAN.has(draft.type) ? { guardianContact: draft.guardian.trim() } : {}),
      ...(reading ? { deviceLocation: reading } : {}),
    };

    try {
      const created = await submitReport(body, Boolean(user));
      setResult(created);
      await sendEvidence(created);
    } catch (err) {
      setError(err);
      setPhase('review');
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(result.trackingRef);
      setCopied(true);
    } catch {
      // clipboard blocked: the code is still on screen
    }
  }

  function startOver() {
    reset();
    navigate('/report');
  }

  if (phase === 'done' && result) {
    return (
      <div className="page">
        <div className="card done">
          <span className="tick"><CheckIcon /></span>
          <h2>{t('prev.doneTitle')}</h2>
          {user ? (
            <>
              <p>{t('prev.doneSigned')}</p>
              <Link className="btn primary" to="/my-reports">{t('nav.myReports')}</Link>
            </>
          ) : (
            <>
              <p>{t('prev.doneAnon')}</p>
              <div className="code" style={{ marginBottom: 14 }}>{result.trackingRef}</div>
              <div className="actions" style={{ justifyContent: 'center' }}>
                <button className="btn secondary" onClick={copyCode}>{copied ? t('prev.copied') : t('prev.copy')}</button>
                <Link className="btn plain" to={`/track?ref=${encodeURIComponent(result.trackingRef)}`}>{t('prev.checkStatus')}</Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'sending' || phase === 'uploading') {
    return (
      <div className="page">
        <div className="card done" role="status">
          <h2>{phase === 'sending' ? t('prev.sending') : t('prev.uploading')}</h2>
          <p>{t('prev.keepOpen')}</p>
        </div>
      </div>
    );
  }

  if (phase === 'upload-failed') {
    return (
      <div className="page">
        <div className="card done">
          <span className="tick bad"><InfoIcon size={22} /></span>
          <h2>{t('prev.upFailTitle')}</h2>
          <p>{errorText(error, t)}</p>
          <p className="fine">{t('prev.upFailNote')}</p>
          <div className="actions" style={{ justifyContent: 'center' }}>
            {error?.key !== 'err.linkExpired' && (
              <button className="btn primary" onClick={() => sendEvidence(result)}>{t('prev.retryUpload')}</button>
            )}
            <button className="btn plain" onClick={startOver}>{t('prev.startNew')}</button>
          </div>
        </div>
      </div>
    );
  }

  if (!draft.type || !draft.photo) return null; // redirecting

  return (
    <div className="page">
      <h1>{t('prev.title')}</h1>
      <p className="sub">{t('prev.sub')}</p>

      {error && <Callout tone="warn">{errorText(error, t)}</Callout>}

      <div className="card" style={{ marginTop: error ? 16 : 0 }}>
        <div className="row">
          <span className="k">{t('prev.as')}</span>
          <span className="v">
            <span className="chip">{user ? t('prev.signedIn', { email: user.email }) : t('prev.anonymous')}</span>
          </span>
        </div>
        <div className="row"><span className="k">{t('prev.type')}</span><span className="v">{typeName(t, draft.type)}</span></div>
        {NEEDS_GUARDIAN.has(draft.type) && (
          <div className="row"><span className="k">{t('prev.guardian')}</span><span className="v mono">{draft.guardian}</span></div>
        )}
        <div className="row"><span className="k">{t('prev.location')}</span><span className="v">{draft.city}, {draft.quarter}</span></div>
        <div className="row">
          <span className="k">{t('prev.deviceLoc')}</span>
          <span className="v">
            {draft.locState === 'granted' ? (
              <span className="chip">{t('prev.captured')}</span>
            ) : (
              <>
                <span className="chip alert">{t('prev.notShared')}</span>{' '}
                <span className="fine">{t('prev.notSharedNote')}</span>
              </>
            )}
          </span>
        </div>
        <div className="row">
          <span className="k">{t('prev.description')}</span>
          <span className="v">
            {draft.descType === 'text' ? (
              <span style={{ whiteSpace: 'pre-wrap' }}>{draft.text}</span>
            ) : (
              <audio controls src={draft.audio.url} />
            )}
          </span>
        </div>
        <div className="row">
          <span className="k">{t('prev.photo')}</span>
          <span className="v"><img className="thumb" src={draft.photo.url} alt={t('prev.photoAlt')} /></span>
        </div>
      </div>

      <div className="actions" style={{ marginTop: 22 }}>
        <button className="btn primary" onClick={submit}>{t('prev.confirm')}</button>
        <button className="btn plain" onClick={() => navigate('/report')}>{t('prev.edit')}</button>
      </div>
    </div>
  );
}
