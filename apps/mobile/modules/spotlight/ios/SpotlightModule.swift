import CoreSpotlight
import ExpoModulesCore
import UniformTypeIdentifiers

/// One result of the iPhone search, as the app's TypeScript face hands it over.
struct SpotlightItem: Record {
  @Field var route: String = ""
  @Field var title: String = ""
  @Field var details: String = ""
  @Field var searchText: String = ""

  var searchableItem: CSSearchableItem {
    let attributes = CSSearchableItemAttributeSet(contentType: .text)
    attributes.title = title
    attributes.contentDescription = details
    attributes.textContent = searchText
    let item = CSSearchableItem(uniqueIdentifier: route, domainIdentifier: nil, attributeSet: attributes)
    // CoreSpotlight drops an item a month after it was written unless told otherwise;
    // it stays until the next hand-over replaces the index, however long the app sleeps.
    item.expirationDate = .distantFuture
    return item
  }
}

/// Writes the Spotlight Snapshot the Core decided into CoreSpotlight (ADR 0057).
/// It holds no rule about Entries: it only replaces the app's whole index.
public class SpotlightModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SlovoSpotlight")

    AsyncFunction("replaceIndex") { (items: [SpotlightItem]) async throws in
      guard CSSearchableIndex.isIndexingAvailable() else { return }
      let index = CSSearchableIndex.default()
      try await index.deleteAllSearchableItems()
      if !items.isEmpty {
        try await index.indexSearchableItems(items.map(\.searchableItem))
      }
    }
  }
}
