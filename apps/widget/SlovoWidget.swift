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

/// One moment of the widget, from the design's boards: the Widget Mode's name
/// over the headline (and, in medium, the second line) or the mode's empty or
/// broken state, with the band at the bottom. Behind it the mark: the
/// headline's giant first letter in small, the wedge at the right in medium.
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

  /// A colour on the widget's «Тло»: Авто draws the design of each family,
  /// in the phone's appearance; each other choice has colour sets of its own.
  private func color(_ token: String) -> Color {
    switch background {
    case .auto: Color(token + (isSmall ? "Small" : "Medium"))
    case .light: Color(token + "Light")
    case .dark: Color(token + "Dark")
    case .parchment: Color(token + "Parchment")
    case .blue: Color(token + "Blue")
    }
  }

  /// The appearance the band is drawn in: on Авто the light one on the small
  /// widget's red and the phone's on the medium widget; the light one on the
  /// light backgrounds (Світлий, Пергамент), the dark one on the dark.
  private var bandScheme: ColorScheme {
    switch background {
    case .auto: isSmall ? .light : colorScheme
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
            .font(EditionInfo.uiFont(size: 13, weight: .medium))
            .foregroundStyle(color("inkSecondary"))
            .lineLimit(2)
            .minimumScaleFactor(0.75)
            .padding(.top, 6)
        }
      } else if let emptyState = moment.emptyState {
        Text(emptyState)
          .font(EditionInfo.wordFont(size: isSmall ? 17 : 21, weight: .black))
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
    // Clear of the medium widget's wedge, whose slanted edge starts at 60% of its width.
    .padding(.trailing, isSmall ? 0 : 56)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(for: .widget) {
      ZStack {
        color("background")
        mark
      }
    }
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

  /// The mark behind the content, from the boards: in small the headline's
  /// first letter, 200/170 of the widget's height, out past the bottom right
  /// corner; in medium the wedge, 130/364 of the width, slanted on its left.
  @ViewBuilder private var mark: some View {
    if isSmall {
      if let letter = moment.entry?.headline.first {
        GeometryReader { geometry in
          Text(String(letter).uppercased())
            .font(EditionInfo.wordFont(size: geometry.size.height * 200 / 170, weight: .black))
            .foregroundStyle(color("mark"))
            .fixedSize()
            .offset(x: geometry.size.height * 30 / 170, y: geometry.size.height * 40 / 170)
            .frame(width: geometry.size.width, height: geometry.size.height, alignment: .bottomTrailing)
        }
        .accessibilityHidden(true)
      }
    } else {
      GeometryReader { geometry in
        Wedge()
          .fill(color("mark"))
          .frame(width: geometry.size.width * 130 / 364)
          .frame(width: geometry.size.width, height: geometry.size.height, alignment: .trailing)
      }
      .accessibilityHidden(true)
    }
  }

  private var overline: some View {
    Text(moment.overline)
      // The widget overline of the boards: the word font at 800, 10 points, tracked 1.5.
      .font(EditionInfo.wordFont(size: 10, weight: .heavy))
      .tracking(1.5)
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
      .font(EditionInfo.wordFont(size: isSmall ? 21 : 26, weight: .black))
      .foregroundStyle(color("ink"))
      .lineLimit(text.contains(" ") ? 3 : 1)
      .minimumScaleFactor(0.4)
  }
}

/// The medium widget's wedge: its top edge starts at 40% of its width, its bottom at the left.
struct Wedge: Shape {
  func path(in rect: CGRect) -> Path {
    Path { path in
      path.move(to: CGPoint(x: rect.minX + rect.width * 0.4, y: rect.minY))
      path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
      path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
      path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
      path.closeSubpath()
    }
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
