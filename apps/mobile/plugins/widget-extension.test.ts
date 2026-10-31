import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import plist from '@expo/plist';
import { WidgetSnapshotSchema } from '@slovo/contracts';
import { coreDecor, loadDecor } from '@slovo/core';
import { coreFonts } from '@slovo/ui/fonts';
import { coreTokens, designTokens } from '@slovo/ui/tokens';
import { describe, expect, it } from 'vitest';

import { strings, ukrainianFolder } from '../src/test-support';

import { widgetExtensionFiles, writeWidgetExtension, type WidgetEdition } from './widget-extension';

/** Two of the Core's fonts, which the widget draws with. */
const fontFiles = coreFonts().filter((font) =>
  ['Literata-Medium.ttf', 'Manrope-Bold.ttf'].includes(basename(font)),
);

/** The UA Edition as the prebuild hands it to the widget extension. */
const ukrainian: WidgetEdition = {
  config: ukrainianFolder.config,
  scheme: 'slovo-uk',
  appGroup: 'group.app.slovo.uk',
  strings: strings.widget,
  tokens: designTokens(ukrainianFolder.read('tokens')),
  band: loadDecor(ukrainianFolder.read('decor')).divider.band,
  fontFiles,
  exampleSnapshot: ukrainianFolder.path('widgetSnapshotExample'),
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

  const fixed = (name: string) =>
    json(files, `Generated/Assets.xcassets/${name}.colorset/Contents.json`);
  const oneColor = ([red, green, blue, alpha = '1.000']: string[]) => ({
    colors: [
      {
        idiom: 'universal',
        color: { 'color-space': 'srgb', components: { red, green, blue, alpha } },
      },
    ],
    info: { author: 'xcode', version: 1 },
  });

  it.each([
    [
      'Light',
      ['0.961', '0.933', '0.886'],
      ['0.118', '0.094', '0.075'],
      ['0.243', '0.204', '0.165'],
      ['0.639', '0.133', '0.106'],
    ],
    [
      'Dark',
      ['0.082', '0.067', '0.055'],
      ['0.953', '0.918', '0.859'],
      ['0.851', '0.804', '0.725'],
      ['0.831', '0.682', '0.361'],
    ],
  ])(
    'writes the %s background with its ink, secondary ink and accent as colour sets that ignore the appearance',
    (name, background, ink, inkSecondary, accent) => {
      expect(fixed(`background${name}`)).toEqual(oneColor(background));
      expect(fixed(`ink${name}`)).toEqual(oneColor(ink));
      expect(fixed(`inkSecondary${name}`)).toEqual(oneColor(inkSecondary));
      expect(fixed(`accent${name}`)).toEqual(oneColor(accent));
    },
  );

  it.each([
    ['Parchment', ['0.953', '0.914', '0.824'], ['0.231', '0.165', '0.102']],
    ['Blue', ['0.122', '0.227', '0.373'], ['0.953', '0.914', '0.824']],
  ])(
    'writes the %s background and its ink, with the secondary ink as the ink at 72%% and the accent as the ink, since the widget palette has one text colour',
    (name, background, ink) => {
      expect(fixed(`background${name}`)).toEqual(oneColor(background));
      expect(fixed(`ink${name}`)).toEqual(oneColor(ink));
      expect(fixed(`inkSecondary${name}`)).toEqual(oneColor([...ink, '0.720']));
      expect(fixed(`accent${name}`)).toEqual(oneColor(ink));
    },
  );

  it("takes the Parchment and Blue backgrounds from the Edition's widget palette", () => {
    const palette = widgetExtensionFiles({
      ...ukrainian,
      config: {
        ...ukrainian.config,
        widgetPalette: {
          parchment: { background: '#FFFFFF', text: '#000000' },
          blue: { background: '#000000', text: '#FFFFFF' },
        },
      },
    });
    const color = (name: string) =>
      json(palette, `Generated/Assets.xcassets/${name}.colorset/Contents.json`);

    expect(color('backgroundParchment')).toEqual(oneColor(['1.000', '1.000', '1.000']));
    expect(color('inkParchment')).toEqual(oneColor(['0.000', '0.000', '0.000']));
    expect(color('backgroundBlue')).toEqual(oneColor(['0.000', '0.000', '0.000']));
    expect(color('inkBlue')).toEqual(oneColor(['1.000', '1.000', '1.000']));
  });

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

  it("writes the widget's strings, its Widget Modes and its states into the string table of the Edition's language", () => {
    expect(text(files, 'Generated/uk.lproj/Localizable.strings')).toBe(
      '"galleryName" = "Рідкісне слово";\n' +
        '"galleryDescription" = "Нове рідкісне слово на головному екрані кожні п’ять хвилин.";\n' +
        '"allEntries" = "УСІ СЛОВА";\n' +
        '"favorites" = "УЛЮБЛЕНЕ";\n' +
        '"collection" = "КОЛЕКЦІЯ · {name}";\n' +
        '"modeTitle" = "Режим";\n' +
        '"modeFavorites" = "Улюблене";\n' +
        '"modeCollection" = "Колекція";\n' +
        '"modeAllEntries" = "Усі слова";\n' +
        '"collectionTitle" = "Колекція";\n' +
        '"openApp" = "Відкрийте SLOVO";\n' +
        '"noFavorites" = "Додайте слова в Улюблене";\n' +
        '"emptyCollection" = "Колекція порожня";\n' +
        '"deletedCollection" = "Колекцію видалено — оберіть інший режим";\n' +
        '"noCollection" = "Оберіть колекцію для віджета";\n' +
        '"wordOfTheDaySeen" = "Слово дня переглянуто";\n' +
        '"backgroundTitle" = "Тло";\n' +
        '"backgroundAuto" = "Авто";\n' +
        '"backgroundLight" = "Світлий";\n' +
        '"backgroundDark" = "Темний";\n' +
        '"backgroundParchment" = "Пергамент";\n' +
        '"backgroundBlue" = "Синій";\n',
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
    const font = readFileSync(fontFiles[0] ?? '');

    // Buffer.equals, as an element-wise comparison of a whole font is slow.
    expect(font.equals(Buffer.from(files.get('Generated/Literata-Medium.ttf') ?? ''))).toBe(true);
    expect(files.get('Generated/Manrope-Bold.ttf')).toBeInstanceOf(Buffer);
  });

  it('bundles the example Widget Snapshot for the gallery preview', () => {
    expect(
      WidgetSnapshotSchema.safeParse(json(files, 'Generated/widget-snapshot.example.json')).success,
    ).toBe(true);
  });

  it("writes the Info.plist with the fonts, the App Group, the scheme, the Edition id and the Edition's font families", () => {
    expect(plist.parse(text(files, 'Info.plist'))).toEqual({
      CFBundleDevelopmentRegion: 'uk',
      CFBundleDisplayName: 'SLOVO',
      CFBundleLocalizations: ['uk'],
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
      UIAppFonts: ['Literata-Medium.ttf', 'Manrope-Bold.ttf'],
      SLOVOAppGroup: 'group.app.slovo.uk',
      SLOVOURLScheme: 'slovo-uk',
      SLOVOEditionId: 'uk',
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
