# A Category's screen lists its Known Entries first

A Category's screen (ADR 0081) listed its live Entries in the Language Pack's order, as the board draws them (`SlovoApp.dc.html`, `pgWords`), a Known one marked by the «ЗНАЮ» stamp right of its Lemma. The owner wants the Known ones at the top. Behind the Feature Switch `categoryKnownFirst` (needs `categoryScreens`), a Category's screen, of Words and of Corrections, lists its Known Entries first, then the rest; each group keeps the Language Pack's order. The screen reads the order again on every Knowledge Mark, so a card marked Known or unmarked moves at once. The hero's «ЗНАЮ x З n» and the stamps are unchanged.

This departs from the board, where the order is the pack's alone. The Category's Feed (ADR 0110) keeps the Language Pack's order from the tapped Word. With `categoryKnownFirst` off the screen lists all in the Language Pack's order as before.
