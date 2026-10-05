import { config } from '../config';
import { getSession } from './auth';

// `key` is a translation key (see src/i18n), so the message can be shown in either language.
export class ApiError extends Error {
  constructor(message, status, key, params) {
    super(message);
    this.status = status;
    this.key = key;
    this.params = params;
  }
}

// Messages the server sends in English, matched to their translations.
const SERVER_MESSAGES = {
  'Photo evidence is required to submit a report': 'err.photoRequired',
  'A guardian/next-of-kin phone number is required for this incident type': 'err.guardianRequired',
  'Too many reports from this device. Please try again later.': 'err.rateLimited',
  'Another admin already acknowledged this report': 'err.alreadyAck',
  'A case note is required to resolve a report': 'err.noteRequired',
  'This report was just updated by someone else. Refresh and try again.': 'err.conflict',
  'This report can no longer be changed': 'err.amendClosed',
  'Acknowledge this report before changing its status': 'err.ackFirst',
  'Waiting for another group to acknowledge this report': 'err.waitingGroups',
  'A reason is required to close a report without action': 'err.reasonRequired',
  'Transfer it instead: no other team has this report': 'err.cantRelease',
  'That team already has this report': 'err.teamHasIt',
  'Only open reports can be linked': 'err.cantLink',
  'This report is not linked': 'err.notLinked',
  'The reporter asked not to be contacted': 'err.noContact',
  'Wait for the reporter to answer the open question': 'err.questionOpen',
  'At most 3 questions can be asked': 'err.maxQuestions',
  'This question was already answered': 'err.alreadyAnswered',
  'Question not found': 'err.questionGone',
  'Report not found': 'err.reportNotFound',
  "A voice description can't be edited. Add information instead.": 'err.voiceNoEdit',
};

function errorFor(status, data) {
  const message = data.error || data.message;
  // Our own messages first: the backend's rate limit is also a 429, but says something more specific
  // than API Gateway's generic throttle reply.
  if (SERVER_MESSAGES[message]) return new ApiError(message, status, SERVER_MESSAGES[message]);
  if (status === 429) return new ApiError('Too many requests', status, 'api.tooMany');
  if (status === 401) return new ApiError('Session ended', status, 'api.sessionEnded');
  if (status === 403) return new ApiError(message || 'Not allowed', status, 'api.notAllowed');
  if (/^Report already /.test(message || '')) return new ApiError(message, status, 'err.alreadyHandled');
  if (/^Cannot move from /.test(message || '')) return new ApiError(message, status, 'err.badTransition');
  if (message) return new ApiError(message, status);
  return new ApiError(`Error ${status}`, status, 'api.generic', { status });
}

// `auth` is 'citizen' or 'admin' when the route needs a signed-in user.
async function request(path, { method = 'GET', body, auth } = {}) {
  if (!config.apiUrl) throw new ApiError('Not connected', 0, 'api.notConnected');

  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const session = await getSession(auth);
    if (!session) throw new ApiError('Session ended', 401, 'api.sessionEnded');
    headers.Authorization = session.getIdToken().getJwtToken();
  }

  let response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error', 0, 'api.network');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw errorFor(response.status, data);
  return data;
}

// ----- citizen -----

export const submitReport = (body, signedIn) =>
  request(signedIn ? '/reports' : '/reports/anonymous', {
    method: 'POST',
    body,
    auth: signedIn ? 'citizen' : undefined,
  });

export const trackReport = (ref) => request(`/reports/track/${encodeURIComponent(ref.trim())}`);
// The reporter answers a staff question, once. The tracking code is the credential, as for the status.
export const answerQuestion = (ref, questionId, answer) =>
  request(`/reports/track/${encodeURIComponent(ref.trim())}/answer`, { method: 'POST', body: { questionId, answer } });
// Public figures on how reports were handled: totals and rates only
export const getStats = () => request('/stats');
export const myReports = () => request('/reports/mine', { auth: 'citizen' });
export const ownReport = (id) => request(`/reports/mine/${encodeURIComponent(id)}`, { auth: 'citizen' });

// Edit, add to or withdraw a report in the first minutes. `change` is { action: 'edit' | 'add' | 'withdraw', ... }.
// A signed-in reporter is known by their token; an anonymous one proves it with the editToken from submission.
export const amendReport = (id, change, editToken) =>
  editToken
    ? request(`/reports/anonymous/${encodeURIComponent(id)}`, { method: 'PATCH', body: { ...change, editToken } })
    : request(`/reports/mine/${encodeURIComponent(id)}`, { method: 'PATCH', body: change, auth: 'citizen' });

// The server returns an S3 presigned POST: { url, fields }. Fields go first, the file last.
export async function uploadEvidence(upload, blob, contentType) {
  const form = new FormData();
  Object.entries(upload.fields).forEach(([name, value]) => form.append(name, value));
  if (!upload.fields['Content-Type']) form.append('Content-Type', contentType);
  form.append('file', blob);

  let response;
  try {
    response = await fetch(upload.url, { method: 'POST', body: form });
  } catch {
    throw new ApiError('Upload interrupted', 0, 'err.uploadInterrupted');
  }
  if (!response.ok) throw new ApiError('Upload failed', response.status, response.status === 403 ? 'err.linkExpired' : 'err.uploadFailed');
}

// ----- admin -----

// status 'WATCHING': other stations' urgent reports gone unanswered, what and where only
export const adminList = (status) => request(`/reports?status=${encodeURIComponent(status)}`, { auth: 'admin' });
export const adminReport = (id) => request(`/reports/${encodeURIComponent(id)}`, { auth: 'admin' });
export const adminEvidence = (id) => request(`/reports/${encodeURIComponent(id)}/evidence`, { auth: 'admin' });
export const acknowledgeReport = (id) =>
  request(`/reports/${encodeURIComponent(id)}/acknowledge`, { method: 'PATCH', auth: 'admin' });
export const setReportStatus = (id, status, note) =>
  request(`/reports/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    auth: 'admin',
    body: { status, note: note || null },
  });

// Staff actions beyond acknowledging and status changes. Each is recorded on the report.
const staffAction = (id, action, body) =>
  request(`/reports/${encodeURIComponent(id)}/${action}`, { method: 'POST', auth: 'admin', body: body || {} });

export const setPriority = (id, priority) =>
  request(`/reports/${encodeURIComponent(id)}/priority`, { method: 'PATCH', auth: 'admin', body: { priority } });
export const transferReport = (id, toTeam, note) => staffAction(id, 'transfer', { toTeam, note: note || null });
// "Not our area": step out of a report another team also has
export const releaseReport = (id, note) => staffAction(id, 'transfer', { note: note || null });
export const referReport = (id, to, method, note) => staffAction(id, 'refer', { to, method, note: note || null });
export const linkReport = (id, primaryId) => staffAction(id, 'link', { primaryId });
export const unlinkReport = (id) => staffAction(id, 'unlink');
export const keepSeparate = (id, otherId) => staffAction(id, 'separate', { otherId });
// Ask the reporter a question: { template } for a ready-made one, or { text }
export const askReporter = (id, question) => staffAction(id, 'ask', question);
