import Foundation

/// The Widget Snapshot (ADR 0026) the app writes into the App Group: the
/// parts this widget reads. The contracts' `WidgetSnapshotSchema` is the
/// source of truth; the Core decided every Entry and its text already.
struct WidgetSnapshot: Decodable {
  /// The format this widget reads; a snapshot of another format is not read.
  static let readableFormat = 1

  let format: Int
  /// Whether the reader finished the onboarding; until then the widget invites them to open the app.
  let onboardingFinished: Bool
  let entries: [WidgetEntry]
  /// Усі слова: the ids of every Eligible Entry.
  let allEntries: [String]
  /// Улюблене: the ids of the Favorites that are Eligible Entries, newest first.
  let favorites: [String]
  /// The Collections, newest first, empty ones included.
  let collections: [WidgetCollection]
  /// The key the widget's links to an Entry carry, so the app opens only
  /// those as the widget's; the Edition's example has none.
  let linkKey: String?

  /// The Entries of `ids`, in that order.
  func entries(_ ids: [String]) -> [WidgetEntry] {
    let byId = Dictionary(entries.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    return ids.compactMap { byId[$0] }
  }

  /// The Collection with `id`, or nil once it was deleted.
  func collection(_ id: String) -> WidgetCollection? {
    collections.first { $0.id == id }
  }
}

/// An Entry as the widget shows it, its text ready to draw.
struct WidgetEntry: Decodable, Hashable {
  let id: String
  /// A Word's Lemma with its Stress marks, or a Correction's main standard equivalent.
  let headline: String
  /// A Word's primary Definition, or the non-standard form a Correction replaces.
  let secondLine: String
  /// The headline, then the second line, as VoiceOver reads them: whole words,
  /// with no Stress mark, since the voices break a word at the mark.
  let voiceOver: String
}

/// A Collection as its Widget Mode shows it.
struct WidgetCollection: Decodable {
  let id: String
  /// The name the reader gave it.
  let name: String
  /// Its Eligible Entries, newest first; may be empty.
  let entryIds: [String]
}

/// Where the widget finds the Widget Snapshot. It only reads.
enum SnapshotStore {
  /// The file the app renames each new snapshot over.
  static let fileName = "widget-snapshot.json"
  /// The file the app writes a new snapshot into first. The rename takes the
  /// old file away before it puts the new one in, so for that moment the new
  /// snapshot is here, whole.
  static let stagedFileName = "widget-snapshot.staged.json"

  /// The snapshot the app wrote last, or nil before the app has written one.
  /// The file is read again after the staged one, as the rename may finish
  /// between the first two reads.
  static func latest() -> WidgetSnapshot? {
    guard
      let group = EditionInfo.appGroup,
      let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: group)
    else { return nil }
    for name in [fileName, stagedFileName, fileName] {
      if let snapshot = decode(container.appendingPathComponent(name)) { return snapshot }
    }
    return nil
  }

  /// The Edition's example snapshot, bundled with the widget for the gallery.
  static func example() -> WidgetSnapshot? {
    Bundle.main.url(forResource: "widget-snapshot.example", withExtension: "json").flatMap(decode)
  }

  private static func decode(_ url: URL) -> WidgetSnapshot? {
    guard
      let data = try? Data(contentsOf: url),
      let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data),
      snapshot.format == WidgetSnapshot.readableFormat
    else { return nil }
    return snapshot
  }
}
