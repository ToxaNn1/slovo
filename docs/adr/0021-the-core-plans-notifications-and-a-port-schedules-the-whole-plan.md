# The Core plans notifications, and a port schedules the whole plan

From 0.4 each notification carries one Word the reader hasn't Seen. Which Word comes at which time is a rule about eligibility, Seen and the Cycle, so the Core decides it, in the Notifications module of the composition (ADR 0018). The Core declares a notification scheduler port and the shell implements it on `expo-notifications`. The port reports the permission (allowed, denied or not asked yet), asks for it, and replaces every pending notification with a given plan. Tests use a fake that keeps the last plan and lets the test set the permission.

**The plan** is a list of notifications, each a local date, a local time and one Word, with its text and sound. The Core builds the text: the title is the Lemma with its Stress marks, and the body is the primary Definition, cut at a word boundary to 80 characters with the Edition's ellipsis from its UI strings. The sound is the Edition's own when it has one and the reader's sound switch is on, the system sound when the Edition has none, and none when the switch is off.

- **Floating local time.** The plan holds local dates and times, never instants, and the port schedules each one at that wall-clock time in whatever time zone the device is in. 09:00 stays 09:00 after travel and across daylight-saving changes, and planning again in a new time zone keeps the same notifications.
- **The 14-day and 64 bounds.** The plan starts from the next Notification time still ahead today (a time due this minute has passed) and holds 14 days' worth of times from there: 14 notifications for each time a day. It never holds more than 64, the most iOS keeps pending for one app, so 10 times a day reach about 6 days.
- **Reserved as plan records.** The plan is kept in the user state, one record per notification, `notifications.plan.` + the local date + `T` + the local time, holding the Word's id (ADR 0013). A Word with such a record is Reserved; Reserved is never stored on its own. No Word is Reserved twice, and a Correction never is, since a Reserved Entry is a Word.
- **Choosing Words.** Only eligible Words unseen in the current Cycle. Planning again keeps every notification still ahead whose Word is still eligible, unseen and not needed elsewhere (today's Word of the Day goes only to this morning's notification), so the plan doesn't churn on every open; it drops the notifications that have passed or whose times were removed. A new or emptied notification takes the next unseen Word in the Cycle order after the furthest Word planned before, and the unseen Words before it only once those run out, so a notification that passed unopened doesn't bring its Word straight back. When the Cycle has fewer unseen Words than notifications, the latest notifications stay empty: only the Feed starts a new Cycle.
- **The morning notification is the Word of the Day** (glossary). The earliest time of each local day carries that day's Word of the Day, and the Word of the Day module takes a later day's Word from its morning notification. ADR 0016's amendment for 0.4 records the hand-off, which amends the Word of the Day's rules.
- **The Feed doesn't skip Reserved Words** (owner's decision). A Reserved Word may come up in the Feed before its notification; once it is Seen there, the plan is made again at once and its notification gets a new Word.
- **Whole-plan replacement.** Every plan replaces everything scheduled before, so the port works on whole plans and the device can never drift from the Core's plan. The plan is made when the composition opens, when the app returns to the foreground or a new local day starts, when a time is added, changed or removed, when the sound is switched, when the reader allows notifications, when eligibility changes (a hide, an unhide, a Mix change) and when the Feed makes a Reserved Word Seen.
- **Permission.** While the device doesn't allow notifications, denied or not asked yet, the plan is empty and nothing is Reserved, and the Notification times stay stored, so notifications start at once when the reader allows them.

The plan's Word records and the times stay on the device when sync arrives (ADR 0013's sync marks), since each device plans from its own permission and local time.

## Considered Options

- **Instants in the plan** (a UTC time for each notification): rejected. A flight or a daylight-saving change would move 09:00 to another hour until the app is opened again, and the plan may run two weeks without an open.
- **Reserved as its own record per Word**: rejected. It would have to be kept in step with the plan records in every write, and a crash between the two would leave a Word Reserved by no notification. Deriving it from the plan records can't drift.
- **A port that adds and cancels single notifications**: rejected. The Core would have to know what the device still holds, and any missed cancel would leave a stale Word on the device. Replacing the whole plan costs a few dozen calls and keeps the device equal to the plan.
- **The Feed skips Reserved Words**: rejected by the owner. A reader who opens the app often would see the Feed jump over the Words waiting for their notifications.
- **Refill new notifications from the start of the Cycle order**: rejected. A notification that passed unopened frees its Word, which is the earliest unseen one, so the newest notification would bring the same Word back two weeks later.
- **A plan without a time limit, as far as 64 notifications reach**: rejected. With one time a day it would reserve two months of Words, which hiding, the Mix and the Feed would keep invalidating; 14 days keep notifications coming through a busy fortnight.

## Amendment: the onboarding's sample comes from the plan (0.4)

The onboarding's last step shows a sample of the Word of the Day's notification before the reader is asked for permission, so the plan is still empty. The shell built the sample itself from the first Word card of the Feed and the earliest Notification time, which guessed the plan's rule: once this morning's time had passed, or when today's Word of the Day was already Seen, it showed a Word the morning would not bring.

The sample is the next morning notification of a plan made now as if the device let the app notify: the plan's own choice of Words over the stored plan, the Cycle and the Word of the Day, this morning's notification while its time is ahead, else the next day's. Asking for it writes no plan and Reserves nothing, so the permission rule above stands; like a plan, it first lets the day change take the morning Word of a day the composition hasn't turned to (ADR 0022). With no Notification time left there is no morning notification, and the sample is today's Word of the Day, unseen, with no time, as the step showed before. The Core onboarding owns the steps and takes the sample from Notifications; the shell only draws it.

### Considered Options

- **Plan for real before the reader is asked**, so the sample reads the stored plan: rejected. Words would be Reserved for notifications that may never be allowed, against the permission rule.
- **Keep the sample in the shell and pass it the Word of the Day**: rejected. The shell would still repeat the plan's rule for a passed morning and a Seen Word of the Day.

## Amendment: the plan carries the Edition's sound file (0.4)

A planned notification's sound is the Edition's own file (`{ file }`), the system sound or none, so the scheduler adapter plays exactly what the plan says and no longer knows the Edition's sound file beside it. ADR 0023 records the Edition's `notificationSound` as one optional value.

## Amendment: the reader may allow notifications later (0.4)

The 0.4 spec let only the onboarding's «Дозволити сповіщення» ask for permission, yet its «Пізніше» promises the reader can decide later in Settings. iOS shows an app in its notification settings only once the app has asked, so after «Пізніше» or a skip nothing could ever turn notifications on. While permission is not asked yet, the Notifications screen therefore asks too, through the same call of the Notifications module as the onboarding, and a grant plans as it does there. The Settings row reads «Вимкнено» while permission is not allowed, as the plan is empty then. Once the reader has answered, asking again asks nothing: a refusal is undone in the iOS settings, which the screen opens.

### Considered Options

- **Ask only from the onboarding**, as the spec had it: rejected. A reader who chose «Пізніше» would never get notifications, while the row counted the times as if they came.

## Amendment: the plan follows the Feature Switches (0.8.5)

The plan reads the effective values of two Feature Switches (ADR 0040) each time it plans, so a remote switch holds from the next plan, with no reopen of the plan's own. With **notifications** off the plan is empty and nothing is Reserved, as while the device doesn't allow notifications; the Notification times and the sound stay stored, and the plan comes back once the switch is on. The onboarding's sample then has no next morning. With the **Word of the Day** off no notification carries it: the earliest time of a day is a notification like the others, and today's Word of the Day is an ordinary Word to the plan. The plan's other rules are unchanged, and with both switches on the plan is the same.
