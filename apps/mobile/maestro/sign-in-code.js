// Reads the latest Sign-in code sent to `EMAIL` from Mailpit's HTTP API
// (`MAILPIT_URL`, http://localhost:8025 by default) into `output.signInCode`,
// or leaves it unset while no email has come. The code is the six digits of
// the email's subject.

// What Maestro's JavaScript gives a script: its HTTP client and JSON parser,
// the flow's `output`, and the variables the flow passes it.
/* global http, json, output, EMAIL, MAILPIT_URL */
const mailpit = typeof MAILPIT_URL === 'undefined' ? 'http://localhost:8025' : MAILPIT_URL;
const query = encodeURIComponent('to:"' + EMAIL + '"');
const response = http.get(mailpit + '/api/v1/search?query=' + query + '&limit=1');
const latest = json(response.body).messages[0];
const digits = latest === undefined ? null : /\d{6}/.exec(latest.Subject);
if (digits !== null) output.signInCode = digits[0];
