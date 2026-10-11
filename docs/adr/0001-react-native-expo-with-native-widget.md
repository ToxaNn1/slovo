# React Native + Expo, with the widget written natively

SLOVO is built with React Native and Expo (TypeScript), run as an Expo development build rather than in Expo Go. Two things drove the choice: the owner already knows React, and the same code can later ship to Android, where most Ukrainian phones are. The home-screen widget is the exception. WidgetKit cannot run JavaScript, so the widget is written in SwiftUI and reads data the app shares through an App Group.

## Considered Options

- **Swift + SwiftUI**: the best fit for widgets and notifications, but it is a new language for the owner and covers iOS only.
- **Expo Go**: rejected because it cannot include native targets such as a widget extension or App Groups.
