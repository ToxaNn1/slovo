import WidgetKit

/// One moment of the widget: the Entry it shows from `date`, or none before
/// the app has written a snapshot with Entries in it.
struct WordMoment: TimelineEntry {
  let date: Date
  let entry: WidgetEntry?
}

/// The widget's timeline over Усі слова.
struct WordTimeline: TimelineProvider {
  /// How long each Entry stays on the home screen.
  static let step: TimeInterval = 5 * 60
  /// How far ahead one timeline reaches; WidgetKit asks for the next at its end.
  static let span: TimeInterval = 24 * 60 * 60

  /// The Entries from `start`, one every five minutes for 24 hours, in a
  /// shuffle of `entries` taken in turn, so none comes back before every one
  /// has shown. The shuffle draws on the system random source.
  static func moments(of entries: [WidgetEntry], from start: Date) -> [WordMoment] {
    let shuffled = entries.shuffled()
    guard !shuffled.isEmpty else { return [WordMoment(date: start, entry: nil)] }
    return (0..<Int(span / step)).map { index in
      WordMoment(
        date: start.addingTimeInterval(Double(index) * step),
        entry: shuffled[index % shuffled.count])
    }
  }

  /// What the gallery and a loading widget show: the first Entry of the Edition's example.
  static var preview: WordMoment {
    WordMoment(date: Date(), entry: SnapshotStore.example()?.allEntriesShown.first)
  }

  func placeholder(in context: Context) -> WordMoment {
    Self.preview
  }

  func getSnapshot(in context: Context, completion: @escaping (WordMoment) -> Void) {
    if context.isPreview {
      completion(Self.preview)
      return
    }
    let entries = SnapshotStore.latest()?.allEntriesShown ?? []
    completion(WordMoment(date: Date(), entry: entries.randomElement()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<WordMoment>) -> Void) {
    let entries = SnapshotStore.latest()?.allEntriesShown ?? []
    let moments = Self.moments(of: entries, from: Date())
    // With nothing to show, the next timeline waits for the app's reload after its next write.
    completion(Timeline(entries: moments, policy: entries.isEmpty ? .never : .atEnd))
  }
}
