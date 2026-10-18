// A "second device" of the Account for `sync.yaml`, through the API
// (`API_URL`, http://localhost:8787 by default, the address Metro was started
// with) in the Edition `EDITION_ID` (uk by default). With `STEP` 'request' it
// asks for a Sign-in code for `EMAIL`; the flow reads it from Mailpit. With
// the code (`CODE`) it signs in and pushes one Favorite, `ENTRY_ID`. It
// answers `output.secondDevice` with 'requested' or 'pushed', or with the
// status of the call that failed.

// What Maestro's JavaScript gives a script: its HTTP client and JSON parser,
// the flow's `output`, and the variables the flow passes it.
/* global http, json, output, STEP, EMAIL, CODE, ENTRY_ID, API_URL, EDITION_ID */
const api = (typeof API_URL === 'undefined' ? 'http://localhost:8787' : API_URL) + '/v1';
const editionId = typeof EDITION_ID === 'undefined' ? 'uk' : EDITION_ID;
const headers = { 'content-type': 'application/json' };

if (typeof STEP !== 'undefined' && STEP === 'request') {
  const request = http.post(api + '/account/sign-in-codes', {
    headers: headers,
    body: JSON.stringify({ email: EMAIL, editionId: editionId }),
  });
  output.secondDevice = request.ok ? 'requested' : 'request ' + request.status;
} else {
  signInAndPush();
}

function signInAndPush() {
  const signIn = http.post(api + '/account/sessions', {
    headers: headers,
    body: JSON.stringify({ email: EMAIL, code: CODE }),
  });
  if (!signIn.ok) {
    output.secondDevice = 'sign-in ' + signIn.status;
  } else {
    const push = http.post(api + '/editions/' + editionId + '/records', {
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + json(signIn.body).token,
      },
      body: JSON.stringify({
        changes: [
          {
            key: 'favorites.' + ENTRY_ID,
            value: new Date().toISOString(),
            changedAt: Date.now(),
          },
        ],
      }),
    });
    output.secondDevice = push.ok ? 'pushed' : 'push ' + push.status;
  }
}
