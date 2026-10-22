import SwiftUI
import UIKit
import WidgetKit

/// SLOVO's home-screen widget: an Entry of its Widget Mode every five
/// minutes, in the Edition's colours, fonts and band (ADR 0001, 0026). Each
/// widget chooses its mode: Улюблене, a Collection or Усі слова.
@main
struct SlovoWidget: Widget {
  let kind = "SlovoWidget"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: ChooseMode.self, provider: EntryTimeline()) {
      moment in
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
/// in medium, the second line) or the mode's empty or broken state, with the
/// band at the bottom.
struct EntryView: View {
  @Environment(\.widgetFamily) private var family
  let moment: EntryMoment

  private var isSmall: Bool { family == .systemSmall }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(moment.overline)
        // The overline type of the app (`overlineType` in the UI tokens).
        .font(EditionInfo.uiFont(size: 11, weight: .bold))
        .tracking(11 * 0.14)
        .foregroundStyle(Color("accent"))
        // In capitals, as the app's overline type draws it, a Collection's name too.
        .textCase(.uppercase)
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
      } else if let emptyState = moment.emptyState {
        Text(emptyState)
          .font(EditionInfo.wordFont(size: isSmall ? 19 : 21, weight: .medium))
          .foregroundStyle(Color("ink"))
          .lineLimit(4)
          .minimumScaleFactor(0.7)
      }
      // Tiled across the width at the band's own height, which the Edition's Decor sets.
      Image("band")
        .resizable(resizingMode: .tile)
        .frame(height: UIImage(named: "band")?.size.height ?? 0)
        .padding(.top, 10)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    // One element for VoiceOver: the Widget Mode's name, then the Entry's
    // VoiceOver text, which has no Stress mark, or the mode's state (ADR 0026).
    .accessibilityElement(children: .combine)
    .accessibilityLabel(accessibilityText)
  }

  private var accessibilityText: String {
    [moment.overline, moment.entry?.voiceOver ?? moment.emptyState]
      .compactMap { $0 }
      .joined(separator: ". ")
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
