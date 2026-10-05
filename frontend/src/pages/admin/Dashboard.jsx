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
import { RINGS, formatTime, timeAgo, townOf } from '../../lib/incidents';
import {
  AskReporter, DuplicateNotice, LinkInfo, MoreActions, PriorityPill, Timeline, teamName,
} from '../../components/StaffTools';

const TABS = ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED_NO_ACTION', 'FALSE_REPORT', 'WITHDRAWN'];
const ALWAYS_LOADED = ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS'];


// Reports from before priorities existed were all treated as urgent
const priorityOf = (item) => item.priority || 'URGENT';



// What the reporter changed after sending, with the earlier wording kept for comparison
function Amendments({ items }) {
  const { t, lang } = useI18n();
  if (!items?.length) return null;
  const show = (value) => (value && typeof value === 'object' ? [value.quarter, value.landmark].filter(Boolean).join(', ') : value);
  return (
    <>
      <div className="k lbl">{t('dash.amendments')}</div>
      <ul className="hist">
        {items.map((item) => (
          <li key={`${item.kind}-${item.timestamp}-${item.text ?? ''}`}>
            <span className="chip">{t(`dash.amend.${item.kind}`)}</span>
            <span className="meta">{formatTime(item.timestamp, lang)}</span>
            {item.kind === 'EDIT' && item.changes?.map((c) => (
              <p className="change" key={c.field}>
                <b>{t(`dash.field.${c.field}`)}:</b> <s>{show(c.before)}</s> → {show(c.after)}
              </p>
            ))}
            {item.text && <span className="note">{item.text}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

// Who took the report for each group it was sent to, and which groups haven't responded yet
function Acknowledgements({ report }) {
  const { t, lang } = useI18n();
  const groups = report.groupIds || [];
  return (
    <>
      <div className="k lbl">{t('dash.acks')}</div>
      <ul className="hist">
        {groups.map((group) => {
          const ack = report.acks?.[group];
          return (
            <li key={group}>
              <b>{teamName(t, group)}</b>
              {ack ? (
                <span className="chip ok">
                  {ack.staff ? t('dash.ackedBy', { who: t('dash.staffNo', { n: ack.staff }) }) : t('dash.acked')}
                  {ack.at ? ` · ${timeAgo(ack.at, t)}` : ''}
                </span>
              ) : report.pendingGroups?.includes(group) ? (
                <span className="chip alert">{t('dash.ackWaiting')}</span>
              ) : (
                <span className="chip">{t('dash.ackNotNeeded')}</span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

const place = (item) => [item.incidentLocation?.quarter, townOf(item.incidentLocation)].filter(Boolean).join(', ');

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

  // The SUBMITTED list is the source of truth for what is ringing. Only urgent and high reports
  // ring, for at most 3 minutes from when admins were alerted, and stop once acknowledged.
  // Standard reports (theft, burglary, other) wait in the queue without an alarm.
  const unacknowledged = lists.SUBMITTED;
  const ringing = unacknowledged?.filter((r) => RINGS.has(priorityOf(r)));
  useEffect(() => {
    if (!ringing) return;
    syncAlarms(new Set(ringing.map((r) => r.reportId)));
    ringing.forEach((r) => {
      const age = Date.now() - Number(r.alertedAt ?? r.createdAt) * 1000;
      if (age < ALARM_MS) startAlarm(r.reportId, ALARM_MS - age);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      return true;
    } catch (error) {
      setActionError(error);
      refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }

  // The reporter can change a report in its first minutes. If the open one changes (or leaves
  // the loaded lists, as a withdrawn report does), reload it so nobody acts on an old version.
  const openEntry = Object.values(lists).flat().find((r) => r.reportId === selectedId);
  const signature = openEntry ? `${openEntry.status}|${openEntry.lastAmendedAt ?? ''}|${openEntry.lastAnsweredAt ?? ''}` : 'gone';
  const seen = useRef({ id: null, signature: null });
  useEffect(() => {
    const previous = seen.current;
    seen.current = { id: selectedId, signature };
    if (selectedId && previous.id === selectedId && previous.signature !== signature) {
      loadDetail(selectedId, { withEvidence: false });
    }
  }, [selectedId, signature, loadDetail]);

  const acknowledge = (id) => act(() => acknowledgeReport(id));

  function turnOnSound() {
    setSoundOn(unlockAudio());
  }

  function logout() {
    signOut('admin');
    navigate('/admin/sign-in', { replace: true });
  }

  if (!info) return null;

  const alerts = ringing || [];
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
          <span>{info.groups.map((g) => teamName(t, g)).join(', ')} · {info.email}</span>
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
            <div className="tt">{t('dash.newReport', { type: typeName(t, alert.incidentType) })} · {t(`priority.${priorityOf(alert)}`)}</div>
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
              className={`qcard ${item.reportId === selectedId ? 'sel' : ''} ${priorityOf(item) === 'URGENT' ? 'hot' : ''}`}
              onClick={() => setSelectedId(item.reportId)}
            >
              <div className="qtop">
                <span className="qtype">{typeName(t, item.incidentType)}</span>
                <span className="pills">
                  <PriorityPill priority={priorityOf(item)} />
                  <StatusPill status={item.awaitingMyGroup ? 'SUBMITTED' : item.status} />
                </span>
              </div>
              <div className="qmeta">
                <span>{place(item)}</span>
                <span>{item.descriptionType === 'VOICE' ? t('dash.voice') : t('dash.text')}</span>
                {item.dangerNow && <span className="review-tag">{t('dash.dangerNow')}</span>}
                {item.lastAmendedAt && <span className="review-tag">{t('dash.changedTag')}</span>}
                {item.possibleDuplicateOf && <span className="review-tag">{t('dash.dupTag')}</span>}
                {item.questionState === 'WAITING' && <span>{t('dash.tagWaiting')}</span>}
                {item.questionState === 'ANSWERED' && <span className="review-tag">{t('dash.tagAnswered')}</span>}
                {item.linkedCount > 0 && <span>{t('dash.linkedCount', { n: item.linkedCount })}</span>}
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
                <div><div className="k">{t('dash.status')}</div><div className="v"><StatusPill status={report.awaitingMyGroup ? 'SUBMITTED' : report.status} /></div></div>
                <div><div className="k">{t('dash.submitted')}</div><div className="v">{formatTime(report.createdAt, lang)}</div></div>
                <div><div className="k">{t('dash.priority')}</div><div className="v"><PriorityPill priority={priorityOf(report)} />{report.dangerNow && <> <span className="review-tag">{t('dash.dangerNow')}</span></>}</div></div>
                <div>
                  <div className="k">{t('dash.locStated')}</div>
                  <div className="v">
                    {place(report)}
                    {report.incidentLocation?.where && <><br /><span className="fine">{t(`where.${report.incidentLocation.where}`)}</span></>}
                    {report.incidentLocation?.landmark && <><br /><span className="fine">{report.incidentLocation.landmark}</span></>}
                  </div>
                </div>
                <div><div className="k">{t('dash.reported')}</div><div className="v">{report.identified ? t('dash.acct') : t('dash.anon')}</div></div>
                {report.guardianContact && (
                  <div><div className="k">{t('dash.guardian')}</div><div className="v mono">{report.guardianContact}</div></div>
                )}
              </div>

              <DuplicateNotice report={report} suggestion={openEntry?.possibleDuplicateOf} busy={busy} run={act} onOpen={setSelectedId} />
              <LinkInfo report={report} busy={busy} run={act} onOpen={setSelectedId} />

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

              <Acknowledgements report={report} />

              <Amendments items={report.amendments} />

              <div className="k lbl">{t('dash.history')}</div>
              <AskReporter report={report} busy={busy} run={act} />

              <Timeline report={report} />

              {actionError && <Callout tone="warn">{errorText(actionError, t)}</Callout>}

              {report.awaitingMyGroup && (
                <div className="actions">
                  <button className="btn primary" disabled={busy} onClick={() => acknowledge(report.reportId)}>{t('dash.ack')}</button>
                </div>
              )}

              {!report.awaitingMyGroup && (report.status === 'ACKNOWLEDGED' || report.status === 'IN_PROGRESS') && (
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
                    <button
                      className="btn plain"
                      disabled={busy || !note.trim()}
                      title={note.trim() ? undefined : t('dash.noActionHint')}
                      onClick={() => act(() => setReportStatus(report.reportId, 'CLOSED_NO_ACTION', note))}
                    >
                      {t('dash.noAction')}
                    </button>
                  </div>
                </>
              )}

              {report.status !== 'LINKED' && (
                <MoreActions key={report.reportId} report={report} myTeams={info.groups} busy={busy} run={act} />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
