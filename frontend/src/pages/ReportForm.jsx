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
import { INCIDENT_TYPES, MINPROFF_TYPES, NEEDS_GUARDIAN, PHOTO_OPTIONAL, REGION, TOWNS, WHERE } from '../lib/incidents';

const PHONE = /^[+0-9 ()-]{6,30}$/;

// MINPROFF reporters are not contacted unless they choose to be: a question showing up on a
// shared phone could put a victim at risk. Everyone else can be asked a follow-up question.
export const contactAllowed = (draft) => draft.contact ?? !MINPROFF_TYPES.has(draft.type);

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
  const photoOptional = PHOTO_OPTIONAL.has(draft.type);

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
    if (draft.danger === null) found.push('v.danger');
    if (needsGuardian && !PHONE.test(draft.guardian.trim())) found.push('v.guardian');
    if (!draft.where) found.push('v.where');
    if (!draft.town) found.push('v.town');
    if (!draft.quarter.trim()) found.push('v.quarter');
    if (draft.descType === 'text' && !draft.text.trim()) found.push('v.text');
    if (draft.descType === 'voice' && !draft.audio) found.push('v.voice');
    if (!draft.photo && !photoOptional) found.push('v.photo');
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
          {draft.type && <div className="hint">{t(`hint.${draft.type}`)}</div>}
          <div className="hint">{t('form.scope')}</div>
        </div>

        <fieldset className="field">
          <legend className="lbl">{t('form.danger')} <span className="req">*</span></legend>
          <div className="seg" role="group">
            <button type="button" aria-pressed={draft.danger === true} onClick={() => update({ danger: true })}>{t('form.yes')}</button>
            <button type="button" aria-pressed={draft.danger === false} onClick={() => update({ danger: false })}>{t('form.no')}</button>
          </div>
          {draft.danger === true && <Callout tone="warn">{t('form.dangerCall')}</Callout>}
        </fieldset>

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
          <span className="lbl">{t('form.region')}</span>
          <div className="fixed">{t(`region.${REGION}`)}</div>
        </div>

        <fieldset className="field">
          <legend className="lbl">{t('form.where')} <span className="req">*</span></legend>
          <div className="choices">
            {WHERE.map((where) => (
              <label key={where} className={`choice ${draft.where === where ? 'on' : ''}`}>
                <input type="radio" name="where" checked={draft.where === where} onChange={() => update({ where })} />
                <span>
                  {t(`where.${where}`)}
                  {where === 'OUTSIDE' && <span className="d">{t('where.OUTSIDE.d')}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {draft.where && (
          <>
            <div className="field">
              <label htmlFor="town">
                {draft.where === 'IN_TOWN' ? t('form.town') : t('form.nearestTown')} <span className="req">*</span>
              </label>
              <select id="town" className="inp" value={draft.town} onChange={(e) => update({ town: e.target.value })}>
                <option value="">{t('form.townPlaceholder')}</option>
                {TOWNS.map((town) => <option key={town} value={town}>{town}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="quarter">
                {draft.where === 'IN_TOWN' ? t('form.quarter') : t('form.place')} <span className="req">*</span>
              </label>
              <input
                id="quarter"
                className="inp"
                maxLength={100}
                placeholder={draft.where === 'IN_TOWN' ? t('form.quarterPh') : t('form.placePh')}
                value={draft.quarter}
                onChange={(e) => update({ quarter: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="landmark">{t('form.landmark')}</label>
              <input
                id="landmark"
                className="inp"
                maxLength={200}
                placeholder={t('form.landmarkPh')}
                value={draft.landmark}
                onChange={(e) => update({ landmark: e.target.value })}
              />
            </div>
          </>
        )}

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
          <span className="lbl">
            {photoOptional ? t('form.photoOptional') : <>{t('form.photo')} <span className="req">*</span></>}
          </span>
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
                <span className="fine">{t(photoOptional ? 'form.photoNoteOptional' : 'form.photoNote')}</span>
              </span>
            </button>
          )}
          {photoError && <Callout tone="warn">{errorText(photoError, t)}</Callout>}
        </div>

        <label className="check">
          <input type="checkbox" checked={!contactAllowed(draft)} onChange={(e) => update({ contact: !e.target.checked })} />
          <span>
            {t('form.noContact')}
            <span className="d">{t('form.noContactNote')}</span>
          </span>
        </label>
      </div>

      <div className="actions">
        <button type="submit" className="btn primary">{user ? t('form.review') : t('form.submitAnon')}</button>
        <span className="fine">{t('form.previewNote')}</span>
      </div>
    </form>
  );
}
