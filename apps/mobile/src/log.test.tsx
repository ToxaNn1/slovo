import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { logError, logWarning } from './log';

const EMAIL = 'reader@example.com';
/** A Session's token: a long run of token characters, made up for the test. */
const TOKEN = ['fake', 'session', 'token', 'for', 'tests'].join('-');
const IP = '203.0.113.7';
const CODE = '482913';

/** An error whose message quotes everything that must not reach the device's log. */
function leakyError(): Error {
  return new Error(`Session ${TOKEN} for ${EMAIL} from ${IP} refused the Sign-in code ${CODE}`);
}

/** All the text a console call was given, as the device's log would keep it. */
function logged(calls: unknown[][]): string {
  return calls
    .flat()
    .map((part) => (part instanceof Error ? `${part.message}\n${part.stack ?? ''}` : String(part)))
    .join('\n');
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the app logger', () => {
  it("takes the email, token, IP address and Sign-in code out of an error's message", () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    logError('Could not sign in', leakyError());

    const text = logged(consoleError.mock.calls);
    expect(text).toContain('Could not sign in');
    expect(text).toContain('refused the Sign-in code');
    for (const secret of [EMAIL, TOKEN, IP, CODE]) expect(text).not.toContain(secret);
  });

  it('scrubs what it is given that is not an error', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    logError(`Could not sign in ${EMAIL}`, `refused ${CODE}`);

    const text = logged(consoleError.mock.calls);
    expect(text).toContain('Could not sign in');
    for (const secret of [EMAIL, CODE]) expect(text).not.toContain(secret);
  });

  it('scrubs a warning the same way', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    logWarning('Could not write the Widget Snapshot', leakyError());

    const text = logged(consoleWarn.mock.calls);
    expect(text).toContain('Could not write the Widget Snapshot');
    for (const secret of [EMAIL, TOKEN, IP, CODE]) expect(text).not.toContain(secret);
  });
});
