import { useState } from 'react';
import { useI18n } from '../i18n';
import {
  askReporter, keepSeparate, linkReport, referReport, releaseReport, setPriority, transferReport, unlinkReport,
} from '../lib/api';
import {
  MAX_QUESTIONS, PRIORITIES, PRIORITY_CLASS, QUESTION_TEMPLATES, REFER_METHODS, TEAMS, formatTime, shortRef,
} from '../lib/incidents';
import { StatusPill } from './ui';

// A team the translations don't know about still shows, as its own id
export function teamName(t, team) {
  const key = `team.${team}`;
  const name = t(key);
  return name === key ? (team || '').replace(/[.-]/g, ' ') : name;
}

export function PriorityPill({ priority }) {
  const { t } = useI18n();
  return <span className={`pri ${PRIORITY_CLASS[priority] || ''}`}>{t(`priority.${priority}`)}</span>;
}

// "A likely earlier report of the same incident." The dispatcher compares and decides;
// nothing is merged unless they say so.
export function DuplicateNotice({ report, suggestion, busy, run, onOpen }) {
  const { t } = useI18n();
  if (!suggestion || report.status === 'LINKED') return null;
  const minutes = Math.max(0, Math.round((report.createdAt - suggestion.createdAt) / 60));
  return (
    <div className="dup">
      <div>
        <b>{t('dash.dupTitle', { ref: suggestion.ref })}</b>
        <div className="fine">{t('dash.dupWhy', { quarter: suggestion.quarter || '—', n: minutes })}</div>
      </div>
      <div className="actions">
        <button className="btn small plain" onClick={() => onOpen(suggestion.reportId)}>{t('dash.dupOpen')}</button>
        <button className="btn small secondary" disabled={busy} onClick={() => run(() => linkReport(report.reportId, suggestion.reportId))}>
          {t('dash.dupLink')}
        </button>
        <button className="btn small plain" disabled={busy} onClick={() => run(() => keepSeparate(report.reportId, suggestion.reportId))}>
          {t('dash.dupSeparate')}
        </button>
      </div>
    </div>
  );
}

// Which other reports were linked as the same incident, or which one this was linked to
export function LinkInfo({ report, busy, run, onOpen }) {
  const { t } = useI18n();
  if (report.linkedTo) {
    return (
      <div className="dup">
        <div><b>{t('dash.linkedTo', { ref: shortRef(report.linkedTo) })}</b><div className="fine">{t('dash.linkedToNote')}</div></div>
        <div className="actions">
          <button className="btn small plain" onClick={() => onOpen(report.linkedTo)}>{t('dash.dupOpen')}</button>
          <button className="btn small plain" disabled={busy} onClick={() => run(() => unlinkReport(report.reportId))}>{t('dash.unlink')}</button>
        </div>
      </div>
    );
  }
  if (!report.linkedReports?.length) return null;
  return (
    <div className="dup">
      <div>
        <b>{t('dash.linkedHere', { n: report.linkedReports.length + 1 })}</b>
        <div className="actions">
          {report.linkedReports.map((id) => (
            <button key={id} className="btn small plain" onClick={() => onOpen(id)}>{shortRef(id)}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Status changes and staff actions in one timeline, oldest first. Other institutions see the
// team; your own team also sees the staff number.
export function Timeline({ report }) {
  const { t, lang } = useI18n();
  const who = (team, staff) => (staff ? t('dash.byWho', { who: t('dash.staffNo', { n: staff }), group: teamName(t, team) }) : teamName(t, team));
  const entries = [
    ...report.history.map((h) => ({ ...h, at: h.timestamp, type: 'status' })),
    ...(report.actions || []).map((a) => ({ ...a, at: a.timestamp, type: 'action' })),
  ].sort((a, b) => a.at - b.at);
  const describe = (a) => {
    switch (a.kind) {
      case 'PRIORITY': return t('act.PRIORITY', { from: t(`priority.${a.from}`), to: t(`priority.${a.to}`) });
      case 'TRANSFER': return t('act.TRANSFER', { to: teamName(t, a.to) });
      case 'REFER': return t('act.REFER', { to: a.to, method: t(`method.${a.method}`) });
      case 'LINK': return t('act.LINK', { ref: shortRef(a.primaryId) });
      case 'LINKED_HERE': return t('act.LINKED_HERE', { ref: shortRef(a.reportId) });
      case 'UNLINK': return t('act.UNLINK');
      case 'SEPARATE': return t('act.SEPARATE', { ref: shortRef(a.otherId) });
      case 'RELEASE': return t('act.RELEASE');
      default: return a.kind;
    }
  };
  return (
    <ul className="hist">
      {entries.map((e, i) => (
        <li key={`${e.type}-${e.at}-${i}`}>
          {e.type === 'status' ? <StatusPill status={e.status} /> : <span className="chip">{describe(e)}</span>}
          <span className="meta">{formatTime(e.at, lang)}</span>
          {e.type === 'status' && (e.by || e.group) && <span className="meta">{who(e.group, e.by)}</span>}
          {e.type === 'action' && <span className="meta">{who(e.team, e.staff)}</span>}
          {e.note && <span className="note">{e.note}</span>}
        </li>
      ))}
    </ul>
  );
}

// Priority, transfer, "not our area" and referral, folded away until needed
export function MoreActions({ report, myTeams, busy, run }) {
  const { t } = useI18n();
  const [priority, setPriorityChoice] = useState(report.priority || 'URGENT');
  const [team, setTeam] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [referTo, setReferTo] = useState('');
  const [referNote, setReferNote] = useState('');
  const [method, setMethod] = useState('PHONE');
  const open = ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(report.status);
  const others = (report.groupIds || []).filter((g) => !myTeams.includes(g));
  const choices = TEAMS.filter((id) => !(report.groupIds || []).includes(id));

  return (
    <details className="more">
      <summary>{t('dash.more')}</summary>

      {open && (
        <div className="tool">
          <label className="lbl" htmlFor="priority">{t('dash.changePriority')}</label>
          <div className="row-inline">
            <select id="priority" className="inp" value={priority} onChange={(e) => setPriorityChoice(e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
            </select>
            <button className="btn small secondary" disabled={busy || priority === (report.priority || 'URGENT')}
              onClick={() => run(() => setPriority(report.reportId, priority))}>{t('dash.save')}</button>
          </div>
        </div>
      )}

      {open && (
        <div className="tool">
          <label className="lbl" htmlFor="transfer">{t('dash.transfer')}</label>
          <div className="fine">{t('dash.transferNote')}</div>
          <select id="transfer" className="inp" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">{t('dash.chooseTeam')}</option>
            {choices.map((id) => <option key={id} value={id}>{teamName(t, id)}</option>)}
          </select>
          <input className="inp" aria-label={t('dash.reasonPh')} placeholder={t('dash.reasonPh')} maxLength={500} value={transferNote} onChange={(e) => setTransferNote(e.target.value)} />
          <div className="actions">
            <button className="btn small secondary" disabled={busy || !team}
              onClick={() => window.confirm(t('dash.confirmTransfer', { team: teamName(t, team) })) && run(() => transferReport(report.reportId, team, transferNote))}>
              {t('dash.transferBtn')}
            </button>
            {others.length > 0 && (
              <button className="btn small plain" disabled={busy}
                onClick={() => window.confirm(t('dash.confirmRelease', { team: others.map((g) => teamName(t, g)).join(', ') })) && run(() => releaseReport(report.reportId, transferNote))}>
                {t('dash.release')}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="tool">
        <label className="lbl" htmlFor="refer">{t('dash.refer')}</label>
        <div className="fine">{t('dash.referNote')}</div>
        <input id="refer" className="inp" placeholder={t('dash.referToPh')} maxLength={100} value={referTo} onChange={(e) => setReferTo(e.target.value)} />
        <input className="inp" aria-label={t('dash.noteOptional')} placeholder={t('dash.noteOptional')} maxLength={500} value={referNote} onChange={(e) => setReferNote(e.target.value)} />
        <div className="row-inline">
          <select className="inp" aria-label={t('dash.referHow')} value={method} onChange={(e) => setMethod(e.target.value)}>
            {REFER_METHODS.map((m) => <option key={m} value={m}>{t(`method.${m}`)}</option>)}
          </select>
          <button className="btn small secondary" disabled={busy || !referTo.trim()}
            onClick={() => run(() => referReport(report.reportId, referTo.trim(), method, referNote)).then((ok) => ok && (setReferTo(''), setReferNote('')))}>
            {t('dash.referBtn')}
          </button>
        </div>
      </div>
      <p className="fine">{t('dash.recorded')}</p>
    </details>
  );
}

// A question as written: a ready-made one in the reader's language, or the staff member's own words
export const questionText = (t, q) => (q.template ? t(`q.${q.template}`) : q.text);

// Ask the reporter a question, and read their answers. Only while the case is open, only if the
// reporter allowed contact, one open question at a time and at most three in all.
export function AskReporter({ report, busy, run }) {
  const { t, lang } = useI18n();
  const [choice, setChoice] = useState('');
  const [text, setText] = useState('');
  const questions = report.questions || [];
  const open = ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(report.status);
  const waiting = questions.some((q) => !q.answer);
  const canAsk = open && report.contactAllowed && !waiting && questions.length < MAX_QUESTIONS;
  const custom = choice === 'custom';

  async function send() {
    const question = custom ? { text: text.trim() } : { template: choice };
    if (await run(() => askReporter(report.reportId, question))) {
      setChoice('');
      setText('');
    }
  }

  return (
    <div className="ask">
      <div className="k lbl">{t('dash.askTitle')}</div>
      {!report.contactAllowed && <p className="fine">{t('dash.askNoContact')}</p>}
      {questions.length > 0 && (
        <ul className="hist">
          {questions.map((q) => (
            <li key={q.questionId}>
              <span className="chip">{teamName(t, q.team)}{q.staff ? ` · ${t('dash.staffNo', { n: q.staff })}` : ''}</span>
              <span className="meta">{formatTime(q.askedAt, lang)}</span>
              <span className="note"><b>{questionText(t, q)}</b></span>
              <span className="note">
                {q.answer ? t('dash.answer', { answer: q.answer }) : <span className="fine">{t('dash.awaitingAnswer')}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canAsk && (
        <div className="tool">
          <select className="inp" aria-label={t('dash.askChoose')} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">{t('dash.askChoose')}</option>
            {QUESTION_TEMPLATES.map((key) => <option key={key} value={key}>{t(`q.${key}`)}</option>)}
            <option value="custom">{t('dash.askCustom')}</option>
          </select>
          {custom && (
            <input className="inp" aria-label={t('dash.askCustom')} maxLength={300} placeholder={t('dash.askCustomPh')}
              value={text} onChange={(e) => setText(e.target.value)} />
          )}
          <div className="fine">{t('dash.askNote')}</div>
          <div className="actions">
            <button className="btn small secondary" disabled={busy || !choice || (custom && !text.trim())} onClick={send}>
              {t('dash.askSend')}
            </button>
          </div>
        </div>
      )}
      {open && report.contactAllowed && waiting && <p className="fine">{t('dash.askWaiting')}</p>}
    </div>
  );
}
