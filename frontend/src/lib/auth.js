import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from 'amazon-cognito-identity-js';
import { config } from '../config';
import { keyedError } from './errors';

// Two separate user pools: 'citizen' and 'admin'. Tokens live in sessionStorage, so they
// disappear when the tab closes and are never left behind on a shared or public device.
const pools = {};

function getPool(kind) {
  const { poolId, clientId } = config[kind];
  if (!poolId || !clientId) throw keyedError('Sign-in is not set up', 'auth.notConfigured');
  if (!pools[kind]) {
    pools[kind] = new CognitoUserPool({
      UserPoolId: poolId,
      ClientId: clientId,
      Storage: window.sessionStorage,
    });
  }
  return pools[kind];
}

const normalise = (email) => email.trim().toLowerCase();

function makeUser(kind, email) {
  return new CognitoUser({
    Username: normalise(email),
    Pool: getPool(kind),
    Storage: window.sessionStorage,
  });
}

// ----- citizen account -----

export function signUp(email, password) {
  return new Promise((resolve, reject) => {
    const address = normalise(email);
    getPool('citizen').signUp(
      address,
      password,
      [new CognitoUserAttribute({ Name: 'email', Value: address })],
      null,
      (err, result) => (err ? reject(err) : resolve(result)),
    );
  });
}

export function confirmSignUp(email, code) {
  return new Promise((resolve, reject) => {
    makeUser('citizen', email).confirmRegistration(code.trim(), true, (err, result) =>
      err ? reject(err) : resolve(result),
    );
  });
}

export function resendCode(email) {
  return new Promise((resolve, reject) => {
    makeUser('citizen', email).resendConfirmationCode((err, result) =>
      err ? reject(err) : resolve(result),
    );
  });
}

// ----- sign-in (both pools) -----
// Resolves { status: 'ok' } | { status: 'new-password', user } | { status: 'totp', user }

export function signIn(kind, email, password) {
  return new Promise((resolve, reject) => {
    const user = makeUser(kind, email);
    user.authenticateUser(
      new AuthenticationDetails({ Username: normalise(email), Password: password }),
      {
        onSuccess: () => resolve({ status: 'ok' }),
        onFailure: reject,
        newPasswordRequired: () => resolve({ status: 'new-password', user }),
        totpRequired: () => resolve({ status: 'totp', user }),
        mfaRequired: () => reject(keyedError('SMS MFA unsupported', 'auth.smsMfa')),
        mfaSetup: () => reject(keyedError('MFA setup needed', 'auth.mfaSetup')),
      },
    );
  });
}

export function completeNewPassword(user, newPassword) {
  return new Promise((resolve, reject) => {
    user.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: () => resolve({ status: 'ok' }),
      onFailure: reject,
      totpRequired: () => resolve({ status: 'totp', user }),
    });
  });
}

export function submitTotp(user, code) {
  return new Promise((resolve, reject) => {
    user.sendMFACode(
      code.trim(),
      { onSuccess: () => resolve({ status: 'ok' }), onFailure: reject },
      'SOFTWARE_TOKEN_MFA',
    );
  });
}

// ----- sessions -----

// Resolves a valid session (refreshing tokens if needed) or null.
export function getSession(kind) {
  return new Promise((resolve) => {
    let user;
    try {
      user = getPool(kind).getCurrentUser();
    } catch {
      resolve(null);
      return;
    }
    if (!user) {
      resolve(null);
      return;
    }
    user.getSession((err, session) => resolve(!err && session && session.isValid() ? session : null));
  });
}

export function sessionInfo(session) {
  const payload = session.getIdToken().payload;
  return {
    sub: payload.sub,
    email: payload.email,
    groups: payload['cognito:groups'] || [],
  };
}

export function signOut(kind) {
  try {
    getPool(kind).getCurrentUser()?.signOut();
  } catch {
    // not configured, nothing to sign out of
  }
}
