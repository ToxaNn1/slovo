# Handoff: Media Store wave (spec #1764)

Role: 🧭 Координатор · Media Store (#1764). First step: title the thread, then `uptime` (load > 90 → stop).
Read: docs/agents/map.md, implement-spec SKILL.md (follow it fully), memory media-storage-1109.md, ~/Downloads/WORD/plans/media-storage-research-1109.md (code pointers), ADR 0099, CONTEXT.md terms Media Store / Starter Media / Recording Kind / Recording / Illustration / Patch.
Spec #1764; tickets #1765–#1772 (STAR, blockers in body). Frontier: #1765 and #1771 in parallel. Integration branch feat/1764-media-store, one PR to main; main merge only on the owner's word.
Test seams (owner approved): backend HTTP API on real Postgres with fake Media Store + fake generator; Core over a real pack with fake backend, memory cache, fake fetcher; Pronunciation button / Word card with fake player.
Reserved: migration 0022; ADR 0099 amendment in #1771 (Railway = Amsterdam, Neon = Frankfurt; owner reports the actual Railway region).
Accounts: owner uses a personal test email and a test name for Cloudflare R2 and Neon now, moves to the project email later; keep every key only in Railway variables and .env.example names; never put the owner's email in any command or brief.
Rules: conflict-free waves (folder lanes), token budget, Explore for searches, tail/grep output, cloud safety net registration, no AI attribution, commits/pushes/PRs only within the owner's grant below.
Owner grant: ~/.slovo-coord/grant-media-1110.md — «так даю дозволи на все»: commits, pushes, one PR; main merge only on the owner's word. Railway region confirmed: EU West (Amsterdam, Netherlands).

## Task graph
#1765, #1771 free; #1766←1765; #1768←1765; #1767←1766; #1769←1768; #1770←1766,1769; #1772←1766,1767,1769,1770,1771.

## Log (UTC)
- 2026-11-10 08:00 coordinator (laptop, T3 thread «🟢 🧭 Координатор · Media Store (#1764)») created feat/1764-media-store from main 79e6df00b; launching #1765 and #1771.
- 2026-11-10 08:10 launched implementers (T3 delegate, Opus, worktrees): #1765 → feat/1765-media-rows, #1771 → chore/1771-neon-patch-route. Registered in safety-net WAVES.md (media-1764).
