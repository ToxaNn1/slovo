import { z } from 'zod';

/**
 * A domain such as `slovo.example`: dot-separated lower-case labels of letters,
 * digits and inner hyphens, ending in a top-level domain of letters.
 */
export const DomainSchema = z
  .string()
  .regex(
    /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/,
    'Expected a lower-case domain such as slovo.example',
  );

/**
 * The domains reserved for examples and tests (RFC 2606), the top-level ones
 * and the second-level `example.com`, `example.net` and `example.org`, such as
 * the placeholder `slovo.example`: no link to them, or to a name under them,
 * opens anywhere.
 */
const RESERVED_DOMAINS = [
  'example',
  'test',
  'invalid',
  'localhost',
  'example.com',
  'example.net',
  'example.org',
];

/** Whether the domain is a reserved one or a name under it. */
export const isReservedDomain = (domain: string) =>
  RESERVED_DOMAINS.some((reserved) => domain === reserved || domain.endsWith(`.${reserved}`));

/** A message for a placeholder domain a release build refuses. */
export const placeholderDomainMessage = (domain: string) =>
  `"${domain}" is a placeholder: a release build needs the real domain`;

/** A path to a file, relative to the repository root, such as `editions/uk/assets/icon.png`. */
const RepoFileSchema = z
  .string()
  .regex(
    /^(?!\/)(?!.*(^|\/)\.\.?(\/|$))[A-Za-z0-9._/-]+$/,
    'Expected a path relative to the repository root, without . or .. segments',
  );

/** The name of an EAS build profile in `eas.json`. */
const BuildProfileSchema = z.string().regex(/^[a-z][a-z0-9-]*$/, 'Expected an EAS build profile');

/**
 * The identity of the one SLOVO app (ADR 0065): everything that is the same
 * for every Edition inside it. Adding an Edition never touches it; everything
 * per language stays in the EditionConfig.
 */
export const AppConfigSchema = z
  .strictObject({
    /** The app's name on the home screen and in the store. */
    name: z.string().min(1),
    /** The URL scheme of the app's links, `<scheme>://<route>`. */
    scheme: z.string().regex(/^[a-z][a-z0-9+.-]*$/, 'Expected a lower-case URL scheme'),
    /** The bundle id, also SLOVO's client id at Apple for Sign in with Apple (ADR 0047). */
    bundleId: z
      .string()
      .regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, 'Expected a reverse-DNS bundle id'),
    /**
     * The Apple Developer Team ID the app is signed with: the backend's
     * app-site-association file names the app by it. Empty until the owner
     * fills it in; a release build refuses it empty.
     */
    appleTeamId: z
      .string()
      .regex(/^([A-Z0-9]{10})?$/, 'Expected an Apple Team ID of ten upper-case letters and digits'),
    /** The app's id in App Store Connect, which TestFlight uploads name. Empty until the app is created. */
    appStoreConnectAppId: z
      .string()
      .regex(/^(\d+)?$/, 'Expected the App Store Connect app id, a number'),
    /**
     * The app's one domain (ADR 0065), which its associated domains entitlement
     * claims. `slovo.example` until the name is chosen; a release build refuses
     * a placeholder.
     */
    domain: DomainSchema,
    /** The app icon, a 1024×1024 PNG. */
    icon: RepoFileSchema,
    /** The native splash, a `splash.json` of Decor slot 7, its images beside it (ADR 0014). */
    splash: RepoFileSchema,
    /** The one Update channel the app's OTA updates come from (ADR 0062). */
    updateChannel: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Expected a lower-case channel name'),
    /** The EAS build profiles of each platform, one per kind of build. */
    buildProfiles: z.strictObject({
      ios: z.strictObject({ development: BuildProfileSchema, release: BuildProfileSchema }),
    }),
  })
  // The App Group the app shares with its widget (ADR 0026), derived from the
  // bundle id, never authored.
  .transform((config) => ({ ...config, appGroup: `group.${config.bundleId}` }));

export type AppConfig = z.infer<typeof AppConfigSchema>;

/** A field of a config that a release build refuses, and why. */
export interface ReleaseProblem<Field extends string> {
  readonly field: Field;
  readonly message: string;
}

/**
 * What a release build refuses in a valid AppConfig: the placeholders a
 * development build keeps, a domain reserved for examples and an empty Team
 * ID. Empty when the app is ready for release.
 */
export function appReleaseProblems({
  domain,
  appleTeamId,
}: AppConfig): ReleaseProblem<'domain' | 'appleTeamId'>[] {
  const problems: ReleaseProblem<'domain' | 'appleTeamId'>[] = [];
  if (isReservedDomain(domain)) {
    problems.push({ field: 'domain', message: placeholderDomainMessage(domain) });
  }
  if (appleTeamId === '') {
    problems.push({
      field: 'appleTeamId',
      message: 'Empty: a release build needs the Apple Team ID the app is signed with',
    });
  }
  return problems;
}
