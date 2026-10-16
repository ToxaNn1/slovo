import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import plist from '@expo/plist';
import {
  editionAppGroup,
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
  readonly strings: EditionStrings['widget'];
  readonly tokens: DesignTokens;
  /** The divider's band (Decor slot 2), drawn under the headline. */
  readonly band: DecorMotif;
  /** The font files the extension bundles, as absolute paths. */
  readonly fontFiles: readonly string[];
  /** The Edition's example Widget Snapshot, which the gallery preview shows. */
  readonly exampleSnapshot: string;
}

/** The colour tokens the widget draws with. */
const WIDGET_COLORS = ['background', 'ink', 'inkSecondary', 'accent'] as const;

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

/** A colour as an SVG fill: the hex value, and its opacity when it has one. */
function svgFill(color: string): string {
  const [red, green, blue, alpha] = rgba(color);
  const hex = [red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return alpha === 1 ? `fill="#${hex}"` : `fill="#${hex}" fill-opacity="${String(alpha)}"`;
}

/** A Decor motif in one colour scheme, light or dark, as an SVG document. */
function motifSvg({ width, height, layers }: DecorMotif, colorScheme: 'light' | 'dark'): string {
  const size = `width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}"`;
  const paths = layers.map((layer) => `<path d="${layer.path}" ${svgFill(layer[colorScheme])}/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" ${size}>${paths.join('')}</svg>\n`;
}

/** A string in a `.strings` file: quoted, with its quotes, backslashes and line breaks escaped. */
const quoted = (value: string) =>
  `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`;

/**
 * The files the prebuild writes into the widget extension's folder
 * (`apps/widget`), by path in that folder: the colour tokens the widget uses
 * as colour sets, the divider band as a vector image, both light and dark;
 * the widget's strings in the Edition's language; the fonts; the example
 * Widget Snapshot for the gallery; and the Info.plist, which names the
 * fonts, the App Group, the URL scheme and the font families. None of them
 * is kept in git.
 */
export function widgetExtensionFiles(edition: WidgetEdition): Map<string, string | Buffer> {
  const { config, tokens, band } = edition;
  const [language = config.locale] = config.locale.split('-');
  const assets = `${GENERATED}/Assets.xcassets`;
  const files = new Map<string, string | Buffer>();

  files.set(`${assets}/Contents.json`, asJson({ info: ASSET_INFO }));
  for (const name of WIDGET_COLORS) {
    files.set(
      `${assets}/${name}.colorset/Contents.json`,
      asJson({
        colors: [
          { idiom: 'universal', color: catalogColor(tokens.colors.light[name]) },
          { idiom: 'universal', appearances: DARK, color: catalogColor(tokens.colors.dark[name]) },
        ],
        info: ASSET_INFO,
      }),
    );
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
  files.set(`${assets}/band.imageset/band-light.svg`, motifSvg(band, 'light'));
  files.set(`${assets}/band.imageset/band-dark.svg`, motifSvg(band, 'dark'));

  files.set(
    `${GENERATED}/${language}.lproj/Localizable.strings`,
    Object.entries(edition.strings)
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
      SLOVOAppGroup: editionAppGroup(config.bundleId),
      SLOVOURLScheme: edition.scheme,
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
