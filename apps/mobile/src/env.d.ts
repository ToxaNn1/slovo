/** The public environment variables the app reads; Expo writes their values into the bundle it builds. */
declare namespace NodeJS {
  interface ProcessEnv {
    /** The backend's address, such as `http://localhost:8787` (spec #333). */
    readonly EXPO_PUBLIC_SLOVO_API_URL?: string;
    /** The app's OAuth client id for iOS at Google; without it «Увійти через Google» stays hidden (ADR 0047). */
    readonly EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
  }
}
