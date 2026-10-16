import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import plist from '@expo/plist';
import {
  EditionConfigSchema,
  EditionStringsSchema,
  EditionTokensSchema,
  WidgetSnapshotSchema,
} from '@slovo/contracts';
import { coreDecor, loadDecor } from '@slovo/core';
import { coreTokens, designTokens } from '@slovo/ui/tokens';
import { describe, expect, it } from 'vitest';

import { widgetExtensionFiles, writeWidgetExtension, type WidgetEdition } from './widget-extension';

const ukrainianEditionDir = fileURLToPath(new URL('../../editions/uk/', import.meta.url));
const read = (file: string) => readFileSync(`${ukrainianEditionDir}${file}`, 'utf8');

/** The Ukrainian Edition as the prebuild hands it to the widget extension. */
const ukrainian: WidgetEdition = {
  config: EditionConfigSchema.parse(JSON.parse(read('edition.json'))),
  scheme: 'slovo-uk',
  strings: EditionStringsSchema.parse(JSON.parse(read('strings.json'))).widget,
  tokens: designTokens(EditionTokensSchema.parse(JSON.parse(read('tokens.json')))),
  band: loadDecor(JSON.parse(read('decor/decor.json'))).divider.band,
  fontFiles: ['Literata-Medium.ttf', 'Manrope-Bold.ttf'].map(
    (font) => `${ukrainianEditionDir}assets/fonts/${font}`,
  ),
  exampleSnapshot: `${ukrainianEditionDir}widget-snapshot.example.json`,
};

const text = (files: Map<string, string | Buffer>, path: string) => {
  const contents = files.get(path);
  if (contents === undefined)
    throw new Error(`No file ${path} among ${[...files.keys()].join(', ')}`);
  return contents.toString();
};

const json = (files: Map<string, string | Buffer>, path: string): unknown =>
  JSON.parse(text(files, path));

const dark = [{ appearance: 'luminosity', value: 'dark' }];

describe("the widget extension's Edition files", () => {
  const files = widgetExtensionFiles(ukrainian);

  it.each([
    ['background', ['0.961', '0.933', '0.886'], ['0.082', '0.067', '0.055']],
    ['ink', ['0.118', '0.094', '0.075'], ['0.953', '0.918', '0.859']],
    ['inkSecondary', ['0.243', '0.204', '0.165'], ['0.851', '0.804', '0.725']],
    ['accent', ['0.639', '0.133', '0.106'], ['0.831', '0.682', '0.361']],
  ])(
    'writes the %s token as a colour set with a light and a dark appearance',
    (name, light, darkRgb) => {
      const components = ([red, green, blue]: string[]) => ({ red, green, blue, alpha: '1.000' });

      expect(json(files, `Generated/Assets.xcassets/${name}.colorset/Contents.json`)).toEqual({
        colors: [
          { idiom: 'universal', color: { 'color-space': 'srgb', components: components(light) } },
          {
            idiom: 'universal',
            appearances: dark,
            color: { 'color-space': 'srgb', components: components(darkRgb) },
          },
        ],
        info: { author: 'xcode', version: 1 },
      });
    },
  );

  it('writes a colour drawn over others with its opacity', () => {
    const translucent = widgetExtensionFiles({
      ...ukrainian,
      tokens: {
        ...ukrainian.tokens,
        colors: {
          light: { ...ukrainian.tokens.colors.light, ink: 'rgba(0, 0, 0, 0.5)' },
          dark: ukrainian.tokens.colors.dark,
        },
      },
    });

    expect(json(translucent, 'Generated/Assets.xcassets/ink.colorset/Contents.json')).toMatchObject(
      {
        colors: [
          {
            color: { components: { red: '0.000', green: '0.000', blue: '0.000', alpha: '0.500' } },
          },
          {},
        ],
      },
    );
  });

  it('renders the divider band (Decor slot 2) to a vector image, light and dark', () => {
    expect(json(files, 'Generated/Assets.xcassets/band.imageset/Contents.json')).toEqual({
      images: [
        { idiom: 'universal', filename: 'band-light.svg' },
        { idiom: 'universal', filename: 'band-dark.svg', appearances: dark },
      ],
      info: { author: 'xcode', version: 1 },
      properties: { 'preserves-vector-representation': true },
    });
    expect(text(files, 'Generated/Assets.xcassets/band.imageset/band-light.svg')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10" viewBox="0 0 16 10">' +
        '<path d="M0 8h2v2H0zM2 6h2v2H2zM4 4h2v2H4zM6 2h2v2H6zM8 0h2v2H8zM10 2h2v2h-2zM12 4h2v2h-2zM14 6h2v2h-2z" fill="#A3221B"/>' +
        '</svg>\n',
    );
    expect(text(files, 'Generated/Assets.xcassets/band.imageset/band-dark.svg')).toContain(
      'fill="#D4AE5C"',
    );
  });

  it("renders the Core's band, with its translucent line, for an Edition without Decor", () => {
    const plain = widgetExtensionFiles({ ...ukrainian, band: coreDecor.divider.band });

    expect(text(plain, 'Generated/Assets.xcassets/band.imageset/band-light.svg')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="1" viewBox="0 0 4 1">' +
        '<path d="M0 0h4v1H0z" fill="#000000" fill-opacity="0.14"/>' +
        '</svg>\n',
    );
  });

  it("writes the widget's strings into the string table of the Edition's language", () => {
    expect(text(files, 'Generated/uk.lproj/Localizable.strings')).toBe(
      '"galleryName" = "Рідкісне слово";\n' +
        '"galleryDescription" = "Нове рідкісне слово на головному екрані кожні п’ять хвилин.";\n' +
        '"allEntries" = "УСІ СЛОВА";\n',
    );
  });

  it('escapes quotes, backslashes and line breaks in a string', () => {
    const quoted = widgetExtensionFiles({
      ...ukrainian,
      strings: { ...ukrainian.strings, galleryName: 'Say "hi"\\\nnow' },
    });

    expect(text(quoted, 'Generated/uk.lproj/Localizable.strings')).toContain(
      '"galleryName" = "Say \\"hi\\"\\\\\\nnow";\n',
    );
  });

  it('bundles the fonts it is given', () => {
    const font = readFileSync(`${ukrainianEditionDir}assets/fonts/Literata-Medium.ttf`);

    // Buffer.equals, as an element-wise comparison of a whole font is slow.
    expect(font.equals(Buffer.from(files.get('Generated/Literata-Medium.ttf') ?? ''))).toBe(true);
    expect(files.get('Generated/Manrope-Bold.ttf')).toBeInstanceOf(Buffer);
  });

  it('bundles the example Widget Snapshot for the gallery preview', () => {
    expect(
      WidgetSnapshotSchema.safeParse(json(files, 'Generated/widget-snapshot.example.json')).success,
    ).toBe(true);
  });

  it("writes the Info.plist with the fonts, the App Group, the scheme and the Edition's font families", () => {
    expect(plist.parse(text(files, 'Info.plist'))).toEqual({
      CFBundleDevelopmentRegion: 'uk',
      CFBundleDisplayName: 'SLOVO',
      CFBundleLocalizations: ['uk'],
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
      UIAppFonts: ['Literata-Medium.ttf', 'Manrope-Bold.ttf'],
      SLOVOAppGroup: 'group.app.slovo.uk',
      SLOVOURLScheme: 'slovo-uk',
      SLOVOWordFont: 'Literata',
      SLOVOUIFont: 'Manrope',
    });
  });

  it('leaves the font families out for an Edition on the system font', () => {
    const system = widgetExtensionFiles({ ...ukrainian, tokens: coreTokens, fontFiles: [] });

    const info = plist.parse(text(system, 'Info.plist')) as Record<string, unknown>;

    expect(info['SLOVOWordFont']).toBeUndefined();
    expect(info['SLOVOUIFont']).toBeUndefined();
    expect(info['UIAppFonts']).toEqual([]);
  });

  it('writes the asset catalog itself', () => {
    expect(json(files, 'Generated/Assets.xcassets/Contents.json')).toEqual({
      info: { author: 'xcode', version: 1 },
    });
  });
});

describe('writing the Edition files into the widget extension', () => {
  it("writes every file and drops those an earlier prebuild left, such as another Edition's font", () => {
    const widgetDir = mkdtempSync(join(tmpdir(), 'slovo-widget-'));
    try {
      mkdirSync(join(widgetDir, 'Generated'));
      writeFileSync(join(widgetDir, 'Generated/Other-Regular.ttf'), 'old');
      writeFileSync(join(widgetDir, 'Widget.swift'), 'kept');

      writeWidgetExtension(widgetDir, ukrainian);

      expect(existsSync(join(widgetDir, 'Generated/Other-Regular.ttf'))).toBe(false);
      expect(readFileSync(join(widgetDir, 'Widget.swift'), 'utf8')).toBe('kept');
      for (const [path, contents] of widgetExtensionFiles(ukrainian)) {
        expect(readFileSync(join(widgetDir, path)).equals(Buffer.from(contents)), path).toBe(true);
      }
    } finally {
      rmSync(widgetDir, { recursive: true, force: true });
    }
  });
});
