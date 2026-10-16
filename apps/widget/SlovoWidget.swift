import SwiftUI
import UIKit
import WidgetKit

/// SLOVO's home-screen widget: an Entry of Усі слова every five minutes, in
/// the Edition's colours, fonts and band (ADR 0001, 0026).
@main
struct SlovoWidget: Widget {
  let kind = "SlovoWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: EntryTimeline()) { moment in
      EntryView(moment: moment)
        .containerBackground(Color("background"), for: .widget)
        .widgetURL(EditionInfo.url(opening: moment.entry))
    }
    .configurationDisplayName(Text("galleryName"))
    .description(Text("galleryDescription"))
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

/// One moment of the widget: the Widget Mode's name over the headline (and,
/// in medium, the second line), with the band at the bottom.
struct EntryView: View {
  @Environment(\.widgetFamily) private var family
  let moment: EntryMoment

  private var isSmall: Bool { family == .systemSmall }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text("allEntries")
        // The overline type of the app (`overlineType` in the UI tokens).
        .font(EditionInfo.uiFont(size: 11, weight: .bold))
        .tracking(11 * 0.14)
        .foregroundStyle(Color("accent"))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      Spacer(minLength: 8)
      if let entry = moment.entry {
        headline(entry.headline)
        if !isSmall {
          Text(entry.secondLine)
            .font(EditionInfo.wordFont(size: 15, weight: .regular))
            .foregroundStyle(Color("inkSecondary"))
            .lineLimit(2)
            .minimumScaleFactor(0.75)
            .padding(.top, 2)
        }
      }
      // Tiled across the width at the band's own height, which the Edition's Decor sets.
      Image("band")
        .resizable(resizingMode: .tile)
        .frame(height: UIImage(named: "band")?.size.height ?? 0)
        .padding(.top, 10)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  /// The headline scales down before it wraps, and wraps only between words,
  /// so a word is never cut mid-letter: a single word stays on one line.
  private func headline(_ text: String) -> some View {
    Text(text)
      .font(EditionInfo.wordFont(size: isSmall ? 30 : 34, weight: .medium))
      .foregroundStyle(Color("ink"))
      .lineLimit(text.contains(" ") ? 3 : 1)
      .minimumScaleFactor(0.4)
  }
}
