import WidgetKit

/// One moment of the widget: the Entry it shows from `date`, or none before
/// the app has written a snapshot with Entries in it.
struct EntryMoment: TimelineEntry {
  let date: Date
  let entry: WidgetEntry?
}

/// The widget's timeline over Усі слова.
struct EntryTimeline: TimelineProvider {
  /// How long each Entry stays on the home screen.
  static let step: TimeInterval = 5 * 60
  /// How far ahead one timeline reaches; WidgetKit asks for the next at its end.
  static let span: TimeInterval = 24 * 60 * 60

  /// The Entries from `start`, one every five minutes for 24 hours, in a
  /// shuffle of `entries` taken in turn, so none comes back before every one
  /// has shown. The widget shuffles with the system random source.
  static func moments<R: RandomNumberGenerator>(
    of entries: [WidgetEntry], from start: Date, using random: inout R
  ) -> [EntryMoment] {
    let shuffled = entries.shuffled(using: &random)
    guard !shuffled.isEmpty else { return [EntryMoment(date: start, entry: nil)] }
    return (0..<Int(span / step)).map { index in
      EntryMoment(
        date: start.addingTimeInterval(Double(index) * step),
        entry: shuffled[index % shuffled.count])
    }
  }

  /// What the gallery and a loading widget show: the first Entry of the Edition's example.
  static var preview: EntryMoment {
    EntryMoment(date: Date(), entry: SnapshotStore.example()?.allEntriesInOrder.first)
  }

  func placeholder(in context: Context) -> EntryMoment {
    Self.preview
  }

  func getSnapshot(in context: Context, completion: @escaping (EntryMoment) -> Void) {
    if context.isPreview {
      completion(Self.preview)
      return
    }
    var random = SystemRandomNumberGenerator()
    let entries = SnapshotStore.latest()?.allEntriesInOrder ?? []
    completion(EntryMoment(date: Date(), entry: entries.randomElement(using: &random)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<EntryMoment>) -> Void) {
    var random = SystemRandomNumberGenerator()
    let entries = SnapshotStore.latest()?.allEntriesInOrder ?? []
    let moments = Self.moments(of: entries, from: Date(), using: &random)
    // With nothing to show, the next timeline waits for the app's reload after its next write.
    completion(Timeline(entries: moments, policy: entries.isEmpty ? .never : .atEnd))
  }
}
