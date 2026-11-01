import Foundation

/// What one widget shows in its Widget Mode: the mode's overline over its
/// Entries or, with none to show, the line of its empty or broken state.
/// The text is the Edition's, from the extension's string table.
struct ModeContent {
  let overline: String
  /// The Entries the mode shows, in the snapshot's order.
  let entries: [WidgetEntry]
  /// The line of the empty or broken state, when the mode has no Entry to show.
  let emptyState: String?
  /// The snapshot's key for the widget's links to an Entry.
  let linkKey: String?
  /// The local date on which the Word of the Day was last Seen, for the ✓.
  let wordOfTheDaySeenOn: String?
  let goalRing: GoalRing?
  let lockScreenWidget: Bool

  init(of snapshot: WidgetSnapshot?, _ configuration: ChooseMode) {
    self.init(of: snapshot, mode: configuration.mode, collectionId: configuration.collection?.id)
  }

  init(of snapshot: WidgetSnapshot?, mode: ModeChoice, collectionId: String?) {
    let ids: [String]
    let empty: String
    linkKey = snapshot?.linkKey
    wordOfTheDaySeenOn = snapshot?.wordOfTheDaySeenOn
    goalRing = snapshot?.goalRing
    lockScreenWidget = snapshot?.lockScreenWidget ?? false
    switch mode {
    case .allEntries:
      overline = Self.text("allEntries")
      // Every Entry hidden or out of the Mix: the app is where to change that.
      (ids, empty) = (snapshot?.allEntries ?? [], "openApp")
    case .favorites:
      overline = Self.text("favorites")
      (ids, empty) = (snapshot?.favorites ?? [], "noFavorites")
    case .collection:
      if let collection = collectionId.flatMap({ snapshot?.collection($0) }) {
        overline = Self.text("collection").replacingOccurrences(of: "{name}", with: collection.name)
        (ids, empty) = (collection.entryIds, "emptyCollection")
      } else {
        overline = Self.text("modeCollection")
        (ids, empty) = ([], collectionId == nil ? "noCollection" : "deletedCollection")
      }
    }

    guard let snapshot, snapshot.onboardingFinished else {
      entries = []
      emptyState = Self.text("openApp")
      return
    }
    entries = snapshot.entries(ids)
    emptyState = entries.isEmpty ? Self.text(empty) : nil
  }

  private static func text(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
  }
}
