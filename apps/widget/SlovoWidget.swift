import SwiftUI
import WidgetKit

/// SLOVO's home-screen widget: an Entry of Усі слова every five minutes, in
/// the Edition's colours, fonts and band (ADR 0001, 0026).
@main
struct SlovoWidget: Widget {
  let kind = "SlovoWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: WordTimeline()) { moment in
      WordView(moment: moment)
        .containerBackground(Color("background"), for: .widget)
        .widgetURL(EditionInfo.url(opening: moment.entry))
    }
    .configurationDisplayName(Text("galleryName"))
    .description(Text("galleryDescription"))
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

/// One moment of the widget: the Widget Mode's name over the Lemma (and, in
/// medium, the second line), with the band at the bottom.
struct WordView: View {
  @Environment(\.widgetFamily) private var family
  let moment: WordMoment

  private var isSmall: Bool { family == .systemSmall }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text("allEntries")
        .font(EditionInfo.uiFont(size: 11, weight: .bold))
        .tracking(1.6)
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
      Image("band")
        .resizable(resizingMode: .tile)
        .frame(height: 10)
        .padding(.top, 10)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  /// The headline scales down before it wraps, and wraps only between words,
  /// so a word is never cut mid-letter.
  private func headline(_ text: String) -> some View {
    Text(text)
      .font(EditionInfo.wordFont(size: isSmall ? 30 : 34, weight: .medium))
      .foregroundStyle(Color("ink"))
      .lineLimit(text.contains(" ") ? 2 : 1)
      .minimumScaleFactor(0.4)
  }
}
