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
export const myReports = () => request('/reports/mine', { auth: 'citizen' });

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
