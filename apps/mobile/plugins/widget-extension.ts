import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import plist from '@expo/plist';
import {
  type ColorTokens,
  type DecorMotif,
  type EditionConfig,
  type EditionStrings,
} from '@slovo/contracts';
import type { DesignTokens } from '@slovo/ui/tokens';

/**
 * What the home-screen widget takes from the Edition at build time, so its
 * Swift code holds no Edition data: only the layout.
 */
export interface WidgetEdition {
  readonly config: EditionConfig;
  /** The app's URL scheme, which the widget's links open. */
  readonly scheme: string;
  /** The App Group the app shares with its widget (ADR 0026). */
  readonly appGroup: string;
  readonly strings: EditionStrings['widget'];
  readonly tokens: DesignTokens;
  /** The divider's band (Decor slot 2), drawn under the headline. */
  readonly band: DecorMotif;
  /** The font files the extension bundles, as absolute paths. */
  readonly fontFiles: readonly string[];
  /** The Edition's example Widget Snapshot, which the gallery preview shows. */
  readonly exampleSnapshot: string;
}

/** The widget's colours: its background, its inks, its accent and the mark (the giant letter, the wedge). */
const WIDGET_COLORS = ['background', 'ink', 'inkSecondary', 'accent', 'mark'] as const;
type WidgetColors = Record<(typeof WIDGET_COLORS)[number], string>;

/** A background's colours in the light and the dark appearance, the same for a fixed «Тло». */
interface Appearances {
  readonly light: WidgetColors;
  readonly dark: WidgetColors;
}

const inBothAppearances = (colors: WidgetColors): Appearances => ({ light: colors, dark: colors });

/**
 * The opacity of the secondary ink on Пергамент and Синій: the widget palette
 * gives each one text colour, so the second line and the ✓ draw it fainter.
 */
const SECONDARY_INK_OPACITY = 0.72;

/** The opacity of the second line on the medium widget's Авто, as the design draws it. */
const MEDIUM_SECOND_LINE_OPACITY = 0.85;

/** The opacity of the mark on Пергамент and Синій, faint behind the ink of their one text colour. */
const PALETTE_MARK_OPACITY = 0.16;

/** A `#RRGGBB` colour at an opacity, as a colour token. */
function withOpacity(color: string, opacity: number): string {
  const [red, green, blue] = rgba(color);
  return `rgba(${String(red)}, ${String(green)}, ${String(blue)}, ${String(opacity)})`;
}

/**
 * The widget's backgrounds («Тло», ADR 0026), each with the colours the
 * widget draws on it in the light and the dark appearance. Авто is the
 * design's widget, one per family: the small one red in both appearances,
 * with the key ink and a giant letter in the on-accent colour; the medium one
 * on the appearance's background, with its ink, the second line fainter and
 * the red wedge. Світлий and Темний take one appearance of the colour tokens,
 * with the accent as the mark; Пергамент and Синій take the Edition's widget
 * palette, whose text colour is also the accent, fainter the secondary ink
 * and faintest the mark.
 */
function widgetBackgrounds({ config, tokens }: WidgetEdition): Record<string, Appearances> {
  const { parchment, blue } = config.widgetPalette;
  const { light, dark } = tokens.colors;
  const theme = ({ background, ink, accent }: DesignTokens['colors']['light']) => ({
    background,
    ink,
    inkSecondary: ink,
    accent,
    mark: accent,
  });
  const fromPalette = ({ background, text }: { background: string; text: string }) => ({
    background,
    ink: text,
    inkSecondary: withOpacity(text, SECONDARY_INK_OPACITY),
    accent: text,
    mark: withOpacity(text, PALETTE_MARK_OPACITY),
  });
  const medium = ({ background, ink, accent }: DesignTokens['colors']['light']) => ({
    background,
    ink,
    inkSecondary: withOpacity(ink, MEDIUM_SECOND_LINE_OPACITY),
    accent,
    mark: accent,
  });
  return {
    Small: inBothAppearances({
      background: light.accent,
      ink: light.ink,
      inkSecondary: light.ink,
      accent: light.ink,
      mark: light.onAccent,
    }),
    Medium: { light: medium(light), dark: medium(dark) },
    Light: inBothAppearances(theme(light)),
    Dark: inBothAppearances(theme(dark)),
    Parchment: inBothAppearances(fromPalette(parchment)),
    Blue: inBothAppearances(fromPalette(blue)),
  };
}

/** The folder of the extension that holds every file made from the Edition. */
const GENERATED = 'Generated';

const ASSET_INFO = { author: 'xcode', version: 1 };
const DARK = [{ appearance: 'luminosity', value: 'dark' }];

const asJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** A colour token (`#RRGGBB` or `rgba(r, g, b, a)`) as its red, green, blue and opacity. */
function rgba(color: string): [red: number, green: number, blue: number, alpha: number] {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (hex !== null) {
    const [red, green, blue] = hex.slice(1).map((pair) => parseInt(pair, 16));
    return [red ?? 0, green ?? 0, blue ?? 0, 1];
  }
  const functional = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(color);
  if (functional === null) throw new Error(`Not a colour token: ${color}`);
  const [red, green, blue, alpha] = functional.slice(1).map(Number);
  return [red ?? 0, green ?? 0, blue ?? 0, alpha ?? 1];
}

/** A colour as an asset catalog writes it. */
function catalogColor(color: string) {
  const [red, green, blue, alpha] = rgba(color);
  const unit = (channel: number) => (channel / 255).toFixed(3);
  return {
    'color-space': 'srgb',
    components: { red: unit(red), green: unit(green), blue: unit(blue), alpha: alpha.toFixed(3) },
  };
}

/** A colour as an SVG fill: the hex value, and its opacity, the layer's included, when below 1. */
function svgFill(color: string, opacity = 1): string {
  const [red, green, blue, colorAlpha] = rgba(color);
  const alpha = colorAlpha * opacity;
  const hex = [red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return alpha === 1 ? `fill="#${hex}"` : `fill="#${hex}" fill-opacity="${String(alpha)}"`;
}

/** A Decor motif in the colour tokens of one colour scheme, as an SVG document. */
function motifSvg({ width, height, layers }: DecorMotif, colors: ColorTokens): string {
  const size = `width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}"`;
  const paths = layers.map(
    (layer) => `<path d="${layer.path}" ${svgFill(colors[layer.color], layer.opacity)}/>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" ${size}>${paths.join('')}</svg>\n`;
}

/** A string in a `.strings` file: quoted, with its quotes, backslashes and line breaks escaped. */
const quoted = (value: string) =>
  `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`;

/**
 * The files the prebuild writes into the widget extension's folder
 * (`apps/widget`), by path in that folder: the colours of each «Тло», Авто
 * once per family, as colour sets, with a dark appearance where it differs; the divider band as a vector
 * image, light and dark; the widget's strings in the Edition's language; the fonts; the example
 * Widget Snapshot for the gallery; and the Info.plist, which names the
 * fonts, the App Group, the URL scheme, the Edition id and the font families. None of them
 * is kept in git.
 */
export function widgetExtensionFiles(edition: WidgetEdition): Map<string, string | Buffer> {
  const { config, tokens, band } = edition;
  const [language = config.locale] = config.locale.split('-');
  const assets = `${GENERATED}/Assets.xcassets`;
  const files = new Map<string, string | Buffer>();

  files.set(`${assets}/Contents.json`, asJson({ info: ASSET_INFO }));
  for (const [name, { light, dark }] of Object.entries(widgetBackgrounds(edition))) {
    for (const token of WIDGET_COLORS) {
      const lightColor = { idiom: 'universal', color: catalogColor(light[token]) };
      const darkColor = { idiom: 'universal', appearances: DARK, color: catalogColor(dark[token]) };
      files.set(
        `${assets}/${token}${name}.colorset/Contents.json`,
        asJson({
          colors: light[token] === dark[token] ? [lightColor] : [lightColor, darkColor],
          info: ASSET_INFO,
        }),
      );
    }
  }

  files.set(
    `${assets}/band.imageset/Contents.json`,
    asJson({
      images: [
        { idiom: 'universal', filename: 'band-light.svg' },
        { idiom: 'universal', filename: 'band-dark.svg', appearances: DARK },
      ],
      info: ASSET_INFO,
      properties: { 'preserves-vector-representation': true },
    }),
  );
  files.set(`${assets}/band.imageset/band-light.svg`, motifSvg(band, tokens.colors.light));
  files.set(`${assets}/band.imageset/band-dark.svg`, motifSvg(band, tokens.colors.dark));

  files.set(
    `${GENERATED}/${language}.lproj/Localizable.strings`,
    // The widget's own lines are plain text; the guide the app shows in Settings is a group and stays out.
    Object.entries(edition.strings)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value]) => `${quoted(key)} = ${quoted(value)};\n`)
      .join(''),
  );

  // Xcode copies the extension's resources flat into its bundle, so a font is named by its file.
  const fonts = edition.fontFiles.map((file) => basename(file));
  for (const file of edition.fontFiles)
    files.set(`${GENERATED}/${basename(file)}`, readFileSync(file));
  files.set(`${GENERATED}/widget-snapshot.example.json`, readFileSync(edition.exampleSnapshot));

  const { word, ui } = tokens.fontFamilies;
  files.set(
    'Info.plist',
    plist.build({
      CFBundleDevelopmentRegion: language,
      CFBundleDisplayName: config.displayName,
      CFBundleLocalizations: [language],
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
      UIAppFonts: fonts,
      SLOVOAppGroup: edition.appGroup,
      SLOVOURLScheme: edition.scheme,
      SLOVOEditionId: config.id,
      // The widget extension offers the lock-screen families only while the Edition turns them on.
      SLOVOLockScreenWidget: config.featureSwitches.lockScreenWidget,
      ...(word === undefined ? {} : { SLOVOWordFont: word }),
      ...(ui === undefined ? {} : { SLOVOUIFont: ui }),
    }),
  );
  return files;
}

/**
 * Writes the widget extension's Edition files into its folder, replacing
 * those of an earlier prebuild, so no other Edition's file stays behind.
 */
export function writeWidgetExtension(widgetDir: string, edition: WidgetEdition): void {
  rmSync(join(widgetDir, GENERATED), { recursive: true, force: true });
  for (const [path, contents] of widgetExtensionFiles(edition)) {
    const file = join(widgetDir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }
}
