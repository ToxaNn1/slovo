import SwiftUI
import UIKit
import WidgetKit

/// SLOVO's home-screen widget: an Entry of its Widget Mode every five
/// minutes, in the Edition's colours, fonts and band (ADR 0001, 0026). Each
/// widget chooses its mode, Улюблене, a Collection or Усі слова, and its «Тло».
@main
struct SlovoWidgets: WidgetBundle {
  var body: some Widget {
    SlovoWidget()
    SlovoLockScreenWidget()
  }
}

struct SlovoWidget: Widget {
  let kind = "SlovoWidget"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: ChooseMode.self, provider: EntryTimeline()) {
      moment in
      EntryView(moment: moment)
        .widgetURL(EditionInfo.url(opening: moment.entry, key: moment.linkKey))
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
  @Environment(\.widgetRenderingMode) private var renderingMode
  @Environment(\.colorScheme) private var colorScheme
  let moment: EntryMoment

  private var isSmall: Bool { family == .systemSmall }

  /// The widget's «Тло». In the tinted and clear modes the system colours the
  /// widget whatever the choice, so it draws as Авто there.
  private var background: BackgroundChoice {
    renderingMode == .fullColor ? moment.background : .auto
  }

  /// A colour token on the widget's «Тло»: Авто's colour set follows the
  /// phone's appearance, each other choice has colour sets of its own.
  private func color(_ token: String) -> Color {
    switch background {
    case .auto: Color(token)
    case .light: Color(token + "Light")
    case .dark: Color(token + "Dark")
    case .parchment: Color(token + "Parchment")
    case .blue: Color(token + "Blue")
    }
  }

  /// The appearance the band is drawn in: the phone's on Авто, the light one
  /// on the light backgrounds (Світлий, Пергамент), the dark one on the dark.
  private var bandScheme: ColorScheme {
    switch background {
    case .auto: colorScheme
    case .light, .parchment: .light
    case .dark, .blue: .dark
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .firstTextBaseline, spacing: 6) {
        overline
        Spacer(minLength: 0)
        if family == .systemMedium, let ring = moment.goalRing {
          GoalRingView(ring: ring, tint: color("accent"))
        }
        if moment.wordOfTheDaySeen {
          // A quiet ✓ in the corner once today's Word of the Day is Seen (ADR 0026).
          Image(systemName: "checkmark")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(color("inkSecondary"))
        }
      }
      Spacer(minLength: 8)
      if let entry = moment.entry {
        headline(entry.headline)
        if !isSmall {
          Text(entry.secondLine)
            .font(EditionInfo.wordFont(size: 15, weight: .regular))
            .foregroundStyle(color("inkSecondary"))
            .lineLimit(2)
            .minimumScaleFactor(0.75)
            .padding(.top, 2)
        }
      } else if let emptyState = moment.emptyState {
        Text(emptyState)
          .font(EditionInfo.wordFont(size: isSmall ? 19 : 21, weight: .medium))
          .foregroundStyle(color("ink"))
          .lineLimit(4)
          .minimumScaleFactor(0.7)
      }
      // Tiled across the width at the band's own height, which the Edition's Decor sets.
      Image("band")
        .resizable(resizingMode: .tile)
        .frame(height: UIImage(named: "band")?.size.height ?? 0)
        .environment(\.colorScheme, bandScheme)
        .padding(.top, 10)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(color("background"), for: .widget)
    // One element for VoiceOver: the Widget Mode's name, then the Entry's
    // VoiceOver text, which has no Stress mark, or the mode's state, then the
    // ✓'s label (ADR 0026).
    .accessibilityElement(children: .combine)
    .accessibilityLabel(accessibilityText)
  }

  private var accessibilityText: String {
    [
      moment.overline, moment.entry?.voiceOver ?? moment.emptyState,
      moment.wordOfTheDaySeen ? NSLocalizedString("wordOfTheDaySeen", comment: "") : nil,
    ]
    .compactMap { $0 }
    .joined(separator: ". ")
  }

  private var overline: some View {
    Text(moment.overline)
      // The overline type of the app (`overlineType` in the UI tokens).
      .font(EditionInfo.uiFont(size: 11, weight: .bold))
      .tracking(11 * 0.14)
      .foregroundStyle(color("accent"))
      // In capitals, as the app's overline type draws it, a Collection's name too.
      .textCase(.uppercase)
      .lineLimit(1)
      .minimumScaleFactor(0.7)
  }

  /// The headline scales down before it wraps, and wraps only between words,
  /// so a word is never cut mid-letter: a single word stays on one line.
  private func headline(_ text: String) -> some View {
    Text(text)
      .font(EditionInfo.wordFont(size: isSmall ? 30 : 34, weight: .medium))
      .foregroundStyle(color("ink"))
      .lineLimit(text.contains(" ") ? 3 : 1)
      .minimumScaleFactor(0.4)
  }
}

/// The Daily Goal ring, with the Streak beside it while the snapshot carries it. Functional only: the look waits for the design.
struct GoalRingView: View {
  let ring: GoalRing
  let tint: Color

  var body: some View {
    HStack(spacing: 4) {
      Gauge(value: ring.progress) { EmptyView() }
        .gaugeStyle(.accessoryCircularCapacity)
        .tint(tint)
        .scaleEffect(0.4)
        .frame(width: 22, height: 22)
      if let streak = ring.streak {
        Text("\(streak)")
          .font(EditionInfo.uiFont(size: 11, weight: .bold))
          .foregroundStyle(tint)
      }
    }
    .accessibilityLabel("\(ring.xp) / \(ring.goal)" + (ring.streak.map { ", \($0)" } ?? ""))
  }
}

/// The lock-screen widget: the Daily Goal ring, or an Entry of the chosen Widget Mode.
struct SlovoLockScreenWidget: Widget {
  let kind = "SlovoLockScreenWidget"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: ChooseMode.self, provider: EntryTimeline()) {
      moment in
      LockScreenView(moment: moment)
        .widgetURL(EditionInfo.url(opening: moment.entry, key: moment.linkKey))
    }
    .configurationDisplayName(Text("galleryName"))
    .description(Text("galleryDescription"))
    .supportedFamilies(
      EditionInfo.lockScreenWidget ? [.accessoryCircular, .accessoryRectangular] : [])
  }
}

struct LockScreenView: View {
  @Environment(\.widgetFamily) private var family
  let moment: EntryMoment

  var body: some View {
    Group {
      if !moment.lockScreenWidget {
        // Switched off remotely: the app is where to look.
        Text("openApp").font(EditionInfo.uiFont(size: 12, weight: .semibold))
      } else if family == .accessoryCircular {
        if let ring = moment.goalRing {
          Gauge(value: ring.progress) {
            EmptyView()
          } currentValueLabel: {
            Text(ring.streak.map { "\($0)" } ?? "\(ring.xp)")
          }
          .gaugeStyle(.accessoryCircularCapacity)
        } else {
          Text(moment.entry.map { String($0.headline.prefix(1)) } ?? "")
        }
      } else if let entry = moment.entry {
        VStack(alignment: .leading, spacing: 0) {
          Text(entry.headline).font(EditionInfo.wordFont(size: 17, weight: .medium)).lineLimit(1)
          Text(entry.secondLine).font(EditionInfo.wordFont(size: 13, weight: .regular)).lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      } else {
        Text(moment.emptyState ?? moment.overline).lineLimit(2)
      }
    }
    .containerBackground(.clear, for: .widget)
    .accessibilityElement(children: .combine)
  }
}
