import AppIntents
import UIKit

// The App Intents only open the app on a route (ADR 0057). The prebuild
// (plugins/app-intents.ts) copies this file into the app's target, beside
// the App Shortcuts it makes from the Edition's strings with each intent's
// `route`; the titles are keys of the app's Localizable.strings.

/// Opens the app's link `<scheme>://<route>` as the app opens every link from
/// outside. The scheme is the Edition's, which the app config writes into Info.plist.
@MainActor
private func openRoute(_ route: String) {
  guard
    let scheme = Bundle.main.object(forInfoDictionaryKey: "SlovoLinkScheme") as? String,
    let link = URL(string: "\(scheme)://\(route)")
  else { return }
  let application = UIApplication.shared
  // Through the app delegate, so expo-linking keeps it as the initial URL on a cold start.
  _ = application.delegate?.application?(application, open: link, options: [:])
}

/// Opens the app on the Word of the Day card.
struct WordOfTheDayIntent: AppIntent {
  static let title: LocalizedStringResource = "appIntents.wordOfTheDay"
  static let openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult {
    openRoute(Self.route)
    return .result()
  }
}

/// Opens the app on the Game.
struct OpenGameIntent: AppIntent {
  static let title: LocalizedStringResource = "appIntents.openGame"
  static let openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult {
    openRoute(Self.route)
    return .result()
  }
}
