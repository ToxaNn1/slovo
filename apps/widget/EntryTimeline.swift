import WidgetKit

/// One moment of the widget: its Widget Mode's overline over the Entry it
/// shows from `date` or, with none, the mode's empty or broken state.
struct EntryMoment: TimelineEntry {
  let date: Date
  let overline: String
  let entry: WidgetEntry?
  /// The line of the mode's empty or broken state, when it has no Entry.
  let emptyState: String?
}

/// The widget's timeline over the Entries of its Widget Mode.
struct EntryTimeline: AppIntentTimelineProvider {
  /// How long each Entry stays on the home screen.
  static let step: TimeInterval = 5 * 60
  /// How far ahead one timeline reaches; WidgetKit asks for the next at its end.
  static let span: TimeInterval = 24 * 60 * 60

  /// The mode's Entries from `start`, one every five minutes for 24 hours, in
  /// a shuffle taken in turn, so none comes back before every one has shown.
  /// The widget shuffles with the system random source.
  static func moments<R: RandomNumberGenerator>(
    of content: ModeContent, from start: Date, using random: inout R
  ) -> [EntryMoment] {
    let shuffled = content.entries.shuffled(using: &random)
    guard !shuffled.isEmpty else { return [moment(of: content, at: start, showing: nil)] }
    return (0..<Int(span / step)).map { index in
      moment(
        of: content, at: start.addingTimeInterval(Double(index) * step),
        showing: shuffled[index % shuffled.count])
    }
  }

  /// What the gallery and a loading widget show: the first Entry of the
  /// mode in the Edition's example.
  static func preview(_ configuration: ChooseMode) -> EntryMoment {
    let content = ModeContent(of: SnapshotStore.example(), configuration)
    return moment(of: content, at: Date(), showing: content.entries.first)
  }

  private static func moment(of content: ModeContent, at date: Date, showing entry: WidgetEntry?)
    -> EntryMoment
  {
    EntryMoment(date: date, overline: content.overline, entry: entry, emptyState: content.emptyState)
  }

  func placeholder(in context: Context) -> EntryMoment {
    Self.preview(ChooseMode())
  }

  func snapshot(for configuration: ChooseMode, in context: Context) async -> EntryMoment {
    if context.isPreview { return Self.preview(configuration) }
    var random = SystemRandomNumberGenerator()
    let content = ModeContent(of: SnapshotStore.latest(), configuration)
    return Self.moment(
      of: content, at: Date(), showing: content.entries.randomElement(using: &random))
  }

  func timeline(for configuration: ChooseMode, in context: Context) async -> Timeline<EntryMoment>
  {
    var random = SystemRandomNumberGenerator()
    let content = ModeContent(of: SnapshotStore.latest(), configuration)
    let moments = Self.moments(of: content, from: Date(), using: &random)
    // An empty or broken state waits for the app's reload after its next write.
    return Timeline(entries: moments, policy: content.entries.isEmpty ? .never : .atEnd)
  }
}
