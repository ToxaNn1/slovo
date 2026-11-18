---
summary: Behind `savedSwipesOff` an Entry opened from any tab of Saved («Вчу», Favorites, History, «Слова дня», a Collection) takes no side swipes; its corner stays and «⋯» sets the Knowledge Mark; the Feed, links, Search and the Game keep them; off while `swipeMarks` is.
---

# An Entry opened from Saved takes no side swipes

Status: accepted (owner, 15.11)

## Context

With Swipe Marks on (ADR 0077), Entry details take the side swipes that mark the Entry Known or Unknown, wherever the screen opens. On the phone the owner opened Words from the tabs of Saved («Вчу», Favorites, History, «Слова дня», a Collection) to read them, and a sideways move marked them by accident.

## Decision

- Behind `savedSwipesOff`, an Entry opened from any tab of Saved takes no side swipes: no stamp, no undo toast. Its corner stays, and the «⋯» sheet still sets and clears the Knowledge Mark.
- Each Entry route names whether its stack is a tab of Saved; the Feed, a link, Search and the Game keep the swipes.
- `savedSwipesOff` is off while `swipeMarks` is. Off, an Entry opened from Saved is swiped as anywhere else.

## Considered Options

- **The action row with «Знаю» and «Не знаю» back on Saved's Entry details**: not asked for; the corner keeps Entry details the same on every stack.
