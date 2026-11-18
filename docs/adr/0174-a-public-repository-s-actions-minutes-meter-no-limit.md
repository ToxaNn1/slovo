---
summary: The GitHub usage bar leaves the repository's own Actions minutes out while it is public (`GET /repos/{GITHUB_REPOSITORY}`, `private`), as GitHub Free's 2,000 minutes meter private repositories only; other repositories' minutes count, and a failed visibility read counts the repository as private (amends 0164).
---

# A public repository's Actions minutes meter no limit

Owner decision of 2026-11-17, after the cost audit. This ADR amends ADR 0164 (GitHub Actions' usage bar).

**What went wrong.** The GitHub block summed every Actions minute of the owner's month against GitHub Free's 2,000 and showed 1,468 % in November. GitHub's 2,000 included minutes meter private repositories only; a public repository's minutes are free and unlimited, and the billing report gives them a full discount. The repository is public, so the real use of the limit was 0.

**The rule.** The GitHub usage port also reads the repository (`GET /repos/{GITHUB_REPOSITORY}`, the `private` flag) with the same token. While the repository is public, its own minutes leave the sum; any other repository's minutes still count, as their visibility is not read. When the visibility read fails, the repository counts as private, so the bar can over-state but never hide a limit. The bar keeps its 2,000.

**Cost.** Two requests a read instead of one, kept for an hour like every reading (ADR 0164).
