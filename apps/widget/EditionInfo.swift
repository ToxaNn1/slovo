import SwiftUI
import UIKit

/// What the widget takes from the Edition. The prebuild writes it into the
/// extension's Info.plist, beside the colour sets, the band, the fonts and the
/// strings it generates, so this code holds no Edition data.
enum EditionInfo {
  /// The App Group the app writes the Widget Snapshot into.
  static let appGroup = value("SLOVOAppGroup")
  /// The app's URL scheme, which the widget's links open.
  static let urlScheme = value("SLOVOURLScheme")
  /// The id of the Edition the widget was built with: it reads only that
  /// Edition's snapshot, and its links name it, so the app opens them in it.
  static let editionId = value("SLOVOEditionId")
  /// The font family of the headline, or nil for the system font.
  static let wordFontFamily = value("SLOVOWordFont")
  /// The font family of labels, or nil for the system font.
  static let uiFontFamily = value("SLOVOUIFont")

  /// The link that opens an Entry in the app or, without one (an empty or
  /// broken state), the app's root, which is the Feed. It carries the
  /// snapshot's `key`, without which the app opens it as a plain link: the
  /// Entry is not Seen. Each link names the Edition.
  static func url(opening entry: WidgetEntry?, key: String?) -> URL? {
    guard let scheme = urlScheme, let editionId else { return nil }
    guard let entry else { return URL(string: "\(scheme)://?edition=\(editionId)") }
    let keyParam = key.map { "&key=\($0)" } ?? ""
    return URL(string: "\(scheme)://entry/\(entry.id)?from=widget\(keyParam)&edition=\(editionId)")
  }

  /// The Edition's word font at `size`, in the upright face nearest `weight`.
  static func wordFont(size: CGFloat, weight: UIFont.Weight) -> Font {
    font(family: wordFontFamily, size: size, weight: weight)
  }

  /// The Edition's label font at `size`, in the upright face nearest `weight`.
  static func uiFont(size: CGFloat, weight: UIFont.Weight) -> Font {
    font(family: uiFontFamily, size: size, weight: weight)
  }

  private static func value(_ key: String) -> String? {
    Bundle.main.object(forInfoDictionaryKey: key) as? String
  }

  /// A face of a bundled family, picked by weight as React Native picks it in
  /// the app, so the widget's type matches the app's.
  private static func font(family: String?, size: CGFloat, weight: UIFont.Weight) -> Font {
    let upright =
      family.map { UIFont.fontNames(forFamilyName: $0) }?
      .compactMap { UIFont(name: $0, size: size) }
      .filter { !$0.fontDescriptor.symbolicTraits.contains(.traitItalic) } ?? []
    let nearest = upright.min {
      abs(weightOf($0) - weight.rawValue) < abs(weightOf($1) - weight.rawValue)
    }
    return Font(nearest ?? UIFont.systemFont(ofSize: size, weight: weight))
  }

  private static func weightOf(_ font: UIFont) -> CGFloat {
    let traits = font.fontDescriptor.object(forKey: .traits) as? [UIFontDescriptor.TraitKey: Any]
    return traits?[.weight] as? CGFloat ?? UIFont.Weight.regular.rawValue
  }
}
