# The Edition's own editing is no source to name

Every Entry the Edition wrote itself carries the one source «Власна лексикографічна редакція» (ADR 0146). The «Джерело» tab of ADR 0116 then says the same on every card. On the phone check of 16.11.2026 the owner asked to hide the tab for such an Entry.

**Decision.** The Edition names its own editing in its strings (`wordCard.ownSource`). `CardTabs` leaves a source of that title out of the sources it names, and with no other source left it shows no «Джерело» tab, so a card of one own tab has no tab bar at all. An Entry with another source still gets the tab, naming that source only. The content keeps its `sources` as ADR 0146 says.

**Why strings and not the Core.** The title is the Edition's own text; the Core stays language-agnostic and keeps `sourceNames` as they are.

Amends 0116: "a tabbed card always has a tab bar" no longer holds.
