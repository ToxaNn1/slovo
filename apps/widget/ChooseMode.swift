import AppIntents
import WidgetKit

/// The Widget Mode a widget shows, chosen when the reader edits the widget.
/// Each widget keeps its own; a new one starts in Усі слова.
enum ModeChoice: String, AppEnum {
  case favorites
  case collection
  case allEntries

  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "modeTitle")
  static let caseDisplayRepresentations: [ModeChoice: DisplayRepresentation] = [
    .favorites: DisplayRepresentation(title: "modeFavorites"),
    .collection: DisplayRepresentation(title: "modeCollection"),
    .allEntries: DisplayRepresentation(title: "modeAllEntries"),
  ]
}

/// The widget's background, «Тло», chosen beside its Widget Mode (ADR 0026).
/// Each widget keeps its own; a new one starts in Авто, which follows the
/// phone's light or dark appearance.
enum BackgroundChoice: String, AppEnum {
  case auto
  case light
  case dark
  case parchment
  case blue

  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "backgroundTitle")
  static let caseDisplayRepresentations: [BackgroundChoice: DisplayRepresentation] = [
    .auto: DisplayRepresentation(title: "backgroundAuto"),
    .light: DisplayRepresentation(title: "backgroundLight"),
    .dark: DisplayRepresentation(title: "backgroundDark"),
    .parchment: DisplayRepresentation(title: "backgroundParchment"),
    .blue: DisplayRepresentation(title: "backgroundBlue"),
  ]
}

/// A Collection the widget's picker lists, keyed by its id, so a renamed
/// Collection stays chosen and shows its new name.
struct CollectionChoice: AppEntity {
  let id: String
  /// Its name in the latest snapshot, or nil once the snapshot holds no
  /// Collection with this id: the Collection was deleted.
  let name: String?

  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "collectionTitle")
  static let defaultQuery = CollectionQuery()

  var displayRepresentation: DisplayRepresentation {
    guard let name else { return DisplayRepresentation(title: "deletedCollection") }
    return DisplayRepresentation(title: "\(name)")
  }
}

/// The Collections of the latest snapshot, in their own order, newest first.
struct CollectionQuery: EntityQuery {
  func entities(for identifiers: [CollectionChoice.ID]) async throws -> [CollectionChoice] {
    let snapshot = SnapshotStore.latest()
    // An id the snapshot no longer holds stays chosen, so the widget can say
    // its Collection was deleted instead of quietly forgetting the choice.
    return identifiers.map { CollectionChoice(id: $0, name: snapshot?.collection($0)?.name) }
  }

  func suggestedEntities() async throws -> [CollectionChoice] {
    (SnapshotStore.latest()?.collections ?? []).map { CollectionChoice(id: $0.id, name: $0.name) }
  }

  func defaultResult() async -> CollectionChoice? {
    try? await suggestedEntities().first
  }
}

/// The widget's configuration: its Widget Mode, for Колекція which Collection,
/// and its «Тло».
struct ChooseMode: WidgetConfigurationIntent {
  static let title: LocalizedStringResource = "modeTitle"

  @Parameter(title: "modeTitle", default: .allEntries)
  var mode: ModeChoice

  @Parameter(title: "collectionTitle")
  var collection: CollectionChoice?

  @Parameter(title: "backgroundTitle", default: .auto)
  var background: BackgroundChoice

  static var parameterSummary: some ParameterSummary {
    When(\ChooseMode.$mode, .equalTo, ModeChoice.collection) {
      Summary {
        \.$mode
        \.$collection
        \.$background
      }
    } otherwise: {
      Summary {
        \.$mode
        \.$background
      }
    }
  }
}
