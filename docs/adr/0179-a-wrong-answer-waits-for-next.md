# A wrong answer keeps its right answer until «Далі»

Owner decision of 2026-11-18, in the app pass of the Games. This ADR amends ADR 0138.

**Why.** After a wrong answer the answer banner named the right answer for 1.6 s and the Game moved on by itself: too short to read the right answer, which is the point of a wrong answer.

**Decision.** After a wrong answer the answer banner, with the right answer, stays until the reader taps «Далі →» on it; the Game does not move on by itself. In a Game Mode with a time limit («На час»), whose clock keeps running under the banner, the banner of a wrong answer shows no button and the Game moves on by itself after 3 s. A right answer still moves on by itself after 950 ms, 550 ms with a time limit. The Core says which: `answerBannerDelay` gives the delay of an answered Round, or none when it waits for «Далі».

**Consequences.** A wrong answer in «На час» costs 3 s of its 20 s (ADR 0137). «Далі →» is the answer card's string, so no new text.
