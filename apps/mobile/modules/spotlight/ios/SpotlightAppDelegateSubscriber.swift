import CoreSpotlight
import ExpoModulesCore

/// Turns a tap on a search result into the link of its route, `<scheme>://<route>`,
/// and opens it as the app opens every link from outside (ADR 0057). The scheme
/// is the Edition's, which the app config writes into Info.plist.
public class SpotlightAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    guard
      userActivity.activityType == CSSearchableItemActionType,
      let route = userActivity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
      let scheme = Bundle.main.object(forInfoDictionaryKey: "SlovoLinkScheme") as? String,
      let link = URL(string: "\(scheme)://\(route)")
    else { return false }
    // Through the app delegate, so expo-linking keeps it as the initial URL on a cold start.
    _ = application.delegate?.application?(application, open: link, options: [:])
    return true
  }
}
