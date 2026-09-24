import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CameraIcon, MicIcon, StopIcon } from '../components/icons';
import { Callout, ErrorList } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useDraft } from '../context/DraftContext';
import { useRecorder } from '../hooks/useRecorder';
import { typeName, useI18n } from '../i18n';
import { errorText } from '../lib/errors';
import { toJpeg } from '../lib/image';
import { INCIDENT_TYPES, NEEDS_GUARDIAN } from '../lib/incidents';

const PHONE = /^[+0-9 ()-]{6,30}$/;

function ReportingMode({ signedIn }) {
  const { t } = useI18n();
  const account = (on) => (
    <div className={`opt ${on ? 'on' : 'off'}`}>
      <span className="radio" />
      <div>
        <div className="t">{t('mode.account')}</div>
        <div className="d">
          {on ? t('mode.accountOn') : <>{t('mode.accountOff')} <Link to="/sign-in?next=/report">{t('nav.signIn')}</Link></>}
        </div>
      </div>
    </div>
  );
  const anonymous = (on) => (
    <div className={`opt ${on ? 'on' : 'off'}`}>
      <span className="radio" />
      <div>
        <div className="t">{t('mode.anon')}</div>
        <div className="d">{on ? t('mode.anonOn') : t('mode.anonOff')}</div>
      </div>
    </div>
  );

  return (
    <div className="sec">
      <h2>{t('mode.title')}</h2>
      <div className="opts">
        {signedIn ? <>{account(true)}{anonymous(false)}</> : <>{account(false)}{anonymous(true)}</>}
      </div>
    </div>
  );
}

export default function ReportForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { draft, update } = useDraft();
  const { t } = useI18n();
  const [problems, setProblems] = useState([]); // translation keys
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [audioError, setAudioError] = useState('');
  const fileInput = useRef(null);

  const needsGuardian = NEEDS_GUARDIAN.has(draft.type);

  const recorder = useRecorder((result) => {
    if (result.blob.size < 1000) {
      setAudioError('rec.short');
      return;
    }
    setAudioError('');
    if (draft.audio?.url) URL.revokeObjectURL(draft.audio.url);
    update({ audio: { ...result, url: URL.createObjectURL(result.blob) } });
  });

  async function onPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const blob = await toJpeg(file);
      if (draft.photo?.url) URL.revokeObjectURL(draft.photo.url);
      update({ photo: { blob, url: URL.createObjectURL(blob) } });
    } catch (error) {
      setPhotoError(error);
    } finally {
      setPhotoBusy(false);
      event.target.value = '';
    }
  }

  function validate() {
    const found = [];
    if (!draft.type) found.push('v.type');
    if (needsGuardian && !PHONE.test(draft.guardian.trim())) found.push('v.guardian');
    if (!draft.city.trim()) found.push('v.city');
    if (!draft.quarter.trim()) found.push('v.quarter');
    if (draft.descType === 'text' && !draft.text.trim()) found.push('v.text');
    if (draft.descType === 'voice' && !draft.audio) found.push('v.voice');
    if (!draft.photo) found.push('v.photo');
    return found;
  }

  function onContinue(event) {
    event.preventDefault();
    const found = validate();
    setProblems(found);
    if (found.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    navigate('/report/preview');
  }

  const minutes = String(Math.floor(recorder.seconds / 60));
  const secs = String(recorder.seconds % 60).padStart(2, '0');
  const audioProblem = recorder.error || audioError;

  return (
    <form className="page" onSubmit={onContinue} noValidate>
      <h1>{t('form.title')}</h1>
      <p className="sub">{t('form.sub')}</p>

      <ErrorList title={t('form.fixTitle')} items={problems.map((key) => t(key))} />

      <ReportingMode signedIn={Boolean(user)} />

      <div className="sec">
        <div className="field">
          <label htmlFor="type">{t('form.type')} <span className="req">*</span></label>
          <select id="type" className="inp" value={draft.type} onChange={(e) => update({ type: e.target.value })}>
            <option value="">{t('form.typePlaceholder')}</option>
            {INCIDENT_TYPES.map((type) => (
              <option key={type} value={type}>{typeName(t, type)}</option>
            ))}
          </select>
        </div>

        {needsGuardian && (
          <div className="field">
            <label htmlFor="guardian">{t('form.guardian')} <span className="req">*</span></label>
            <input
              id="guardian"
              className="inp mono"
              inputMode="tel"
              autoComplete="off"
              placeholder={t('form.guardianPh')}
              maxLength={30}
              value={draft.guardian}
              onChange={(e) => update({ guardian: e.target.value })}
            />
            <Callout tone="info">
              {t('form.guardianNote', { type: typeName(t, draft.type).toLowerCase() })}
            </Callout>
          </div>
        )}

        <div className="field">
          <span className="lbl">{t('form.where')} <span className="req">*</span></span>
          <div className="two">
            <input
              className="inp"
              aria-label={t('form.city')}
              placeholder={t('form.cityPh')}
              maxLength={100}
              value={draft.city}
              onChange={(e) => update({ city: e.target.value })}
            />
            <input
              className="inp"
              aria-label={t('form.quarter')}
              placeholder={t('form.quarterPh')}
              maxLength={100}
              value={draft.quarter}
              onChange={(e) => update({ quarter: e.target.value })}
            />
          </div>
          {draft.locState === 'granted' && (
            <Callout tone="good"><b>{t('form.locGranted1')}</b> {t('form.locGranted2')}</Callout>
          )}
          {draft.locState === 'denied' && (
            <Callout tone="info"><b>{t('form.locDenied1')}</b> {t('form.locDenied2')}</Callout>
          )}
          {draft.locState === 'unknown' && (
            <Callout tone="info">
              <span>
                {t('form.locUnknown1')} <Link to="/report/location">{t('form.locUnknownLink')}</Link> {t('form.locUnknown2')}
              </span>
            </Callout>
          )}
        </div>

        <div className="field">
          <span className="lbl">{t('form.desc')} <span className="req">*</span></span>
          <div className="seg" role="group" aria-label={t('form.descType')}>
            <button type="button" aria-pressed={draft.descType === 'text'} onClick={() => update({ descType: 'text' })}>
              {t('form.write')}
            </button>
            <button type="button" aria-pressed={draft.descType === 'voice'} onClick={() => update({ descType: 'voice' })}>
              {t('form.record')}
            </button>
          </div>
          {draft.descType === 'text' ? (
            <textarea
              className="inp"
              aria-label={t('form.desc')}
              maxLength={2000}
              placeholder={t('form.descPh')}
              value={draft.text}
              onChange={(e) => update({ text: e.target.value })}
            />
          ) : (
            <div className="voice">
              <button
                type="button"
                className={`rec ${recorder.recording ? 'live' : ''}`}
                onClick={recorder.recording ? recorder.stop : recorder.start}
                aria-label={recorder.recording ? t('form.stopRec') : t('form.startRec')}
              >
                {recorder.recording ? <StopIcon /> : <MicIcon />}
              </button>
              {recorder.recording && <span className="mono">{t('form.recording', { time: `${minutes}:${secs}` })}</span>}
              {!recorder.recording && draft.audio && <audio controls src={draft.audio.url} />}
              {!recorder.recording && !draft.audio && <span className="fine">{t('form.tapMic')}</span>}
            </div>
          )}
          {audioProblem && <Callout tone="warn">{t(audioProblem)}</Callout>}
        </div>

        <div className="field">
          <span className="lbl">{t('form.photo')} <span className="req">*</span></span>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPhoto} />
          {draft.photo ? (
            <div className="photo-preview">
              <img src={draft.photo.url} alt={t('form.photoAlt')} />
              <button type="button" className="btn small plain" onClick={() => fileInput.current.click()}>
                {t('form.changePhoto')}
              </button>
            </div>
          ) : (
            <button type="button" className="drop" onClick={() => fileInput.current.click()} disabled={photoBusy}>
              <CameraIcon />
              <span>
                <b>{photoBusy ? t('form.preparing') : t('form.addPhoto')}</b>
                <br />
                <span className="fine">{t('form.photoNote')}</span>
              </span>
            </button>
          )}
          {photoError && <Callout tone="warn">{errorText(photoError, t)}</Callout>}
        </div>
      </div>

      <div className="actions">
        <button type="submit" className="btn primary">{user ? t('form.review') : t('form.submitAnon')}</button>
        <span className="fine">{t('form.previewNote')}</span>
      </div>
    </form>
  );
}
