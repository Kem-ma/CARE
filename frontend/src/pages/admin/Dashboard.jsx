import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LanguageSwitch from '../../components/LanguageSwitch';
import { Callout, StatusPill } from '../../components/ui';
import { useAlertSocket } from '../../hooks/useAlertSocket';
import { typeName, useI18n } from '../../i18n';
import {
  acknowledgeReport, adminEvidence, adminList, adminReport, setReportStatus,
} from '../../lib/api';
import { ALARM_MS, muteAll, startAlarm, syncAlarms, unlockAudio } from '../../lib/alarm';
import { getSession, sessionInfo, signOut } from '../../lib/auth';
import { errorText } from '../../lib/errors';
import { formatTime, timeAgo } from '../../lib/incidents';

const TABS = ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'FALSE_REPORT'];
const ALWAYS_LOADED = ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS'];


function LocationCheck({ report }) {
  const { t } = useI18n();
  switch (report.proximityFlag) {
    case 'MATCH':
      return <span className="chip ok">{t('dash.locMatch')}</span>;
    case 'REVIEW':
      return <span className="chip alert">{t('dash.locReviewChip', { km: report.locationDistanceKm })}</span>;
    case 'LOCATION_UNAVAILABLE':
      return <span className="chip">{t('dash.locUnavailable')}</span>;
    default:
      return <span className="chip">{t('dash.locNotCompared')}</span>;
  }
}

// A group the translations don't know about still shows, as its own id
function groupName(t, group) {
  const key = `group.${group}`;
  const name = t(key);
  return name === key ? (group || '').replace(/-/g, ' ') : name;
}

const place = (item) => [item.incidentLocation?.city, item.incidentLocation?.quarter].filter(Boolean).join(', ');

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [info, setInfo] = useState(null);
  const [tab, setTab] = useState('SUBMITTED');
  const [lists, setLists] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [soundOn, setSoundOn] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  // Only signed-in admins get here
  useEffect(() => {
    getSession('admin').then((session) => {
      if (!session) navigate('/admin/sign-in', { replace: true });
      else setInfo(sessionInfo(session));
    });
  }, [navigate]);

  const refresh = useCallback(async () => {
    const wanted = [...new Set([...ALWAYS_LOADED, tabRef.current])];
    try {
      const entries = await Promise.all(wanted.map(async (status) => [status, (await adminList(status)).reports]));
      setLists((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
      setLoadError(null);
    } catch (error) {
      if (error.status === 401) navigate('/admin/sign-in', { replace: true });
      else setLoadError(error);
    }
  }, [navigate]);

  // Poll as well as listen: the socket is a fast nudge, the poll is the safety net.
  useEffect(() => {
    if (!info) return undefined;
    const timer = setInterval(refresh, 20000);
    return () => clearInterval(timer);
  }, [info, refresh]);

  // Load on arrival, and again whenever another status tab is opened
  useEffect(() => {
    if (info) refresh();
  }, [tab, info, refresh]);

  const socketStatus = useAlertSocket((message) => {
    if (message.type === 'NEW_REPORT_ALERT') refresh();
  }, Boolean(info));

  // The SUBMITTED list is the source of truth for what is ringing. A report rings for at
  // most 3 minutes from when admins were alerted, and stops the moment it is acknowledged.
  const unacknowledged = lists.SUBMITTED;
  useEffect(() => {
    if (!unacknowledged) return;
    syncAlarms(new Set(unacknowledged.map((r) => r.reportId)));
    unacknowledged.forEach((r) => {
      const age = Date.now() - Number(r.alertedAt ?? r.createdAt) * 1000;
      if (age < ALARM_MS) startAlarm(r.reportId, ALARM_MS - age);
    });
  }, [unacknowledged]);

  const loadDetail = useCallback(async (id, { withEvidence }) => {
    const [report, evidence] = await Promise.allSettled([
      adminReport(id),
      withEvidence ? adminEvidence(id) : Promise.resolve(null),
    ]);
    setDetail((previous) => ({
      loading: false,
      report: report.status === 'fulfilled' ? report.value : previous?.report ?? null,
      evidence: withEvidence ? (evidence.status === 'fulfilled' ? evidence.value : null) : previous?.evidence ?? null,
      error: report.status === 'rejected' ? report.reason : null,
    }));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetail({ loading: true });
    setNote('');
    setActionError(null);
    loadDetail(selectedId, { withEvidence: true });
  }, [selectedId, loadDetail]);

  async function act(action) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      setNote('');
      await Promise.all([refresh(), selectedId ? loadDetail(selectedId, { withEvidence: false }) : null]);
    } catch (error) {
      setActionError(error);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  const acknowledge = (id) => act(() => acknowledgeReport(id));

  function turnOnSound() {
    setSoundOn(unlockAudio());
  }

  function logout() {
    signOut('admin');
    navigate('/admin/sign-in', { replace: true });
  }

  if (!info) return null;

  const alerts = unacknowledged || [];
  const visible = lists[tab] || [];
  const report = detail?.report;

  return (
    <div className="app">
      <header className="admin-bar">
        <Link to="/admin" className="brand"><span className="mark">C</span><b>{t('dash.title')}</b></Link>
        <div className="admin-tools">
          <span className={`live ${socketStatus === 'live' ? 'on' : ''}`} role="status">
            <i /> {socketStatus === 'live' ? t('dash.live') : t('dash.reconnecting')}
          </span>
          <span>{groupName(t, info.groups[0])} · {info.email}</span>
          <LanguageSwitch />
          {soundOn && <button className="btn small plain" onClick={muteAll}>{t('dash.mute')}</button>}
          <button className="btn small plain" onClick={logout}>{t('nav.signOut')}</button>
        </div>
      </header>

      {!soundOn && (
        <div className="alarm-banner quiet" role="status">
          <div className="txt">
            <div className="tt">{t('dash.soundOffTitle')}</div>
            <div className="tsub">{t('dash.soundOffText')}</div>
          </div>
          <button className="btn small" onClick={turnOnSound}>{t('dash.soundOn')}</button>
        </div>
      )}

      {alerts.slice(0, 3).map((alert) => (
        <div className="alarm-banner" key={alert.reportId} role="alert">
          <span className="pulse" aria-hidden="true" />
          <div className="txt">
            <div className="tt">{t('dash.newReport', { type: typeName(t, alert.incidentType) })}</div>
            <div className="tsub">
              {place(alert)} · {t('dash.alerted', { ago: timeAgo(alert.alertedAt ?? alert.createdAt, t) })}
            </div>
          </div>
          <button className="btn small" onClick={() => setSelectedId(alert.reportId)}>{t('dash.open')}</button>
          <button className="btn small" disabled={busy} onClick={() => acknowledge(alert.reportId)}>{t('dash.ack')}</button>
        </div>
      ))}
      {alerts.length > 3 && <p className="fine" style={{ margin: '8px 24px 0' }}>{t('dash.moreWaiting', { n: alerts.length - 3 })}</p>}

      <div className="admin-body">
        <section aria-label={t('dash.queue')}>
          <div className="tabs" role="group" aria-label={t('dash.filter')}>
            {TABS.map((status) => (
              <button key={status} className="tab" aria-pressed={tab === status} onClick={() => setTab(status)}>
                {t(`status.${status}`)}{lists[status] ? ` (${lists[status].length})` : ''}
              </button>
            ))}
          </div>
          {loadError && <p className="errors" role="alert">{errorText(loadError, t)}</p>}
          {!lists[tab] && !loadError && <p className="state" role="status">{t('common.loading')}</p>}
          {lists[tab] && visible.length === 0 && <p className="state">{t('dash.noneHere')}</p>}
          {visible.map((item) => (
            <button
              key={item.reportId}
              className={`qcard ${item.reportId === selectedId ? 'sel' : ''} ${item.proximityFlag === 'REVIEW' ? 'hot' : ''}`}
              onClick={() => setSelectedId(item.reportId)}
            >
              <div className="qtop">
                <span className="qtype">{typeName(t, item.incidentType)}</span>
                <StatusPill status={item.status} />
              </div>
              <div className="qmeta">
                <span>{place(item)}</span>
                <span>{item.descriptionType === 'VOICE' ? t('dash.voice') : t('dash.text')}</span>
                {item.proximityFlag === 'REVIEW' && <span className="review-tag">{t('dash.locReview')}</span>}
                <span>{timeAgo(item.createdAt, t)}</span>
              </div>
            </button>
          ))}
        </section>

        <section className="detail" aria-label={t('dash.detail')}>
          {!selectedId && <p className="state">{t('dash.select')}</p>}
          {selectedId && detail?.loading && <p className="state" role="status">{t('dash.loadingReport')}</p>}
          {detail?.error && <p className="errors" role="alert">{errorText(detail.error, t)}</p>}

          {report && (
            <>
              <h2>{typeName(t, report.incidentType)}</h2>
              <div className="dgrid">
                <div><div className="k">{t('dash.status')}</div><div className="v"><StatusPill status={report.status} /></div></div>
                <div><div className="k">{t('dash.submitted')}</div><div className="v">{formatTime(report.createdAt, lang)}</div></div>
                <div><div className="k">{t('dash.locStated')}</div><div className="v">{report.incidentLocation?.city}, {report.incidentLocation?.quarter}</div></div>
                <div><div className="k">{t('dash.reported')}</div><div className="v">{report.identified ? t('dash.acct') : t('dash.anon')}</div></div>
                {report.guardianContact && (
                  <div><div className="k">{t('dash.guardian')}</div><div className="v mono">{report.guardianContact}</div></div>
                )}
                <div><div className="k">{t('dash.locCheck')}</div><div className="v"><LocationCheck report={report} /></div></div>
              </div>

              <div className="k lbl">{t('dash.description')}</div>
              {report.descriptionType === 'TEXT' ? (
                <div className="desc">{report.descriptionText}</div>
              ) : detail.evidence?.audioUrl ? (
                <div className="evidence"><audio controls src={detail.evidence.audioUrl} /></div>
              ) : (
                <p className="fine">{t('dash.voiceFail')}</p>
              )}

              <div className="k lbl">{t('dash.photoEvidence')}</div>
              <div className="evidence">
                {detail.evidence?.photoUrl
                  ? <img src={detail.evidence.photoUrl} alt={t('dash.photoAlt')} />
                  : <p className="fine">{t('dash.photoFail')}</p>}
              </div>

              <div className="k lbl">{t('dash.history')}</div>
              <ul className="hist">
                {report.history.map((entry) => (
                  <li key={`${entry.status}-${entry.timestamp}`}>
                    <StatusPill status={entry.status} />
                    <span className="meta">{formatTime(entry.timestamp, lang)}</span>
                    {entry.note && <span className="note">{entry.note}</span>}
                  </li>
                ))}
              </ul>

              {actionError && <Callout tone="warn">{errorText(actionError, t)}</Callout>}

              {report.status === 'SUBMITTED' && (
                <div className="actions">
                  <button className="btn primary" disabled={busy} onClick={() => acknowledge(report.reportId)}>{t('dash.ack')}</button>
                </div>
              )}

              {(report.status === 'ACKNOWLEDGED' || report.status === 'IN_PROGRESS') && (
                <>
                  <label className="lbl" htmlFor="note">
                    {report.status === 'IN_PROGRESS' ? t('dash.noteRequired') : t('dash.noteOptional')}
                  </label>
                  <textarea id="note" className="inp note-field" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="actions">
                    {report.status === 'ACKNOWLEDGED' && (
                      <>
                        <button className="btn primary" disabled={busy} onClick={() => act(() => setReportStatus(report.reportId, 'IN_PROGRESS', note))}>
                          {t('dash.inProgress')}
                        </button>
                        <button
                          className="btn plain"
                          disabled={busy}
                          onClick={() => window.confirm(t('dash.confirmFalse')) && act(() => setReportStatus(report.reportId, 'FALSE_REPORT', note))}
                        >
                          {t('dash.falseReport')}
                        </button>
                      </>
                    )}
                    {report.status === 'IN_PROGRESS' && (
                      <button className="btn primary" disabled={busy || !note.trim()} onClick={() => act(() => setReportStatus(report.reportId, 'RESOLVED', note))}>
                        {t('dash.resolve')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
