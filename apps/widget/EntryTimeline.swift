import WidgetKit

/// One moment of the widget: its Widget Mode's overline over the Entry it
/// shows from `date` or, with none, the mode's empty or broken state.
struct EntryMoment: TimelineEntry {
  let date: Date
  let overline: String
  let entry: WidgetEntry?
  /// The line of the mode's empty or broken state, when it has no Entry.
  let emptyState: String?
  /// The snapshot's key, which the link to the Entry carries.
  let linkKey: String?
  /// Whether the Word of the Day was Seen on this moment's local date: the ✓.
  let wordOfTheDaySeen: Bool
}

/// The widget's timeline over the Entries of its Widget Mode.
struct EntryTimeline: AppIntentTimelineProvider {
  /// How long each Entry stays on the home screen.
  static let step: TimeInterval = 5 * 60
  /// A day, should the calendar give no next local midnight.
  static let span: TimeInterval = 24 * 60 * 60
  /// The phone's time zone in the Gregorian calendar, as the Core writes
  /// `wordOfTheDaySeenOn`, whatever calendar the reader chose.
  private static var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .current
    return calendar
  }

  /// The mode's Entries from `start`, one every five minutes up to the next
  /// local midnight and one at it, in a shuffle taken in turn, so none comes
  /// back before every one has shown. The timeline ends at midnight, so the ✓
  /// goes with the day it speaks of (ADR 0026). The widget shuffles with the
  /// system random source.
  static func moments<R: RandomNumberGenerator>(
    of content: ModeContent, from start: Date, using random: inout R
  ) -> [EntryMoment] {
    let midnight =
      calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: start))
      ?? start.addingTimeInterval(span)
    let shuffled = content.entries.shuffled(using: &random)
    // An empty or broken state stays as it is until midnight.
    let times =
      shuffled.isEmpty ? [start] : Array(stride(from: start, to: midnight, by: step))
    return (times + [midnight]).enumerated().map { index, date in
      moment(
        of: content, at: date,
        showing: shuffled.isEmpty ? nil : shuffled[index % shuffled.count])
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
    EntryMoment(
      date: date, overline: content.overline, entry: entry, emptyState: content.emptyState,
      linkKey: content.linkKey, wordOfTheDaySeen: content.wordOfTheDaySeenOn == localDate(date))
  }

  /// The local date of `date` as the Widget Snapshot writes it: `yyyy-MM-dd`.
  private static func localDate(_ date: Date) -> String {
    let day = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", day.year ?? 0, day.month ?? 0, day.day ?? 0)
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
    // An empty or broken state waits, after its midnight moment drops the ✓,
    // for the app's reload after its next write.
    return Timeline(entries: moments, policy: content.entries.isEmpty ? .never : .atEnd)
  }
}
