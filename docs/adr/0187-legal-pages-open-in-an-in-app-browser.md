# The legal pages open in an in-app browser sheet

Owner decision of 2026-11-18, in the app pass (Р12). This ADR amends ADR 0049.

**Why.** «Політика конфіденційності» and «Умови використання» in «Про SLOVO» opened Safari: the reader left the app to read a page and had to find the way back.

**Decision.** The app opens an Edition's legal pages inside the app, in the system's in-app browser (`expo-web-browser`: SFSafariViewController on iOS, a Custom Tab on Android), presented as a page sheet whose close button is «Готово» (`dismissButtonStyle: 'done'`; iOS draws the word in the app's language). `openLegalPage` in `apps/mobile/src/settings/legal-page.ts` is the one place that opens them. The addresses stay as ADR 0049 builds them.

**Consequences.** `expo-web-browser` is a native module, so the change reaches the phone with the next EAS build, not an update. Its config plugin is not listed: without options it changes nothing. Other outside links (the system's notification settings) keep opening where they did.
