# Editions supply Decor as vector data; the Core draws it

An Edition describes its Decor as data in `decor/decor.json`: the Mascot's vector, the accessory the Mascot wears for each Season and Holiday, and the Category pictograms and covers. Each drawing is SVG path data with its colours, so the Core draws it with `react-native-svg` at any size and in either Theme. A contract schema checks the file. The Core owns where Decor appears and how it moves; the Edition only supplies the drawings, so the Core knows nothing about any one culture's motifs.

The Рупор design (ADR 0070) has no ornament layer: no background tile, no divider band, no card corners, no Share Card frame, no empty-state or victory illustration. Screens and cards stand on the Edition's palette and type alone, and the Mascot carries the Edition's character.

Seasonal Decor (ADR 0055) changes only the Mascot's accessory. Beside the Mascot, `decor/decor.json` holds an accessory for each Season and the Edition's Holidays, each a rule (a fixed day and month, or the nth weekday of a month) with its accessory. While «Сезонний декор» and the `seasonalDecor` switch are on, the Mascot wears the accessory of the local date's Holiday, or else of its Season; nothing else changes with the date.

Decor holds shapes and colours only. Words shown with Decor, such as the splash's wordmark and tagline, are Edition strings that the Core lays out. The native splash is a plain colour from `decor/splash.json`, one per Theme, with no image, because it is baked into the build before any JavaScript runs; the app's splash then takes over with the design's splash cut (ADR 0070), which the Core lays out from the Edition's wordmark and tagline.

## Considered Options

- **React components per Edition**: rejected. An Edition would ship code and could change layout or behaviour, against ADR 0006.
- **SVG files**: rejected for now. Metro would need an SVG transformer, nothing would check a file before the app runs, and each Theme would need its own copy of every drawing.
- **PNG images**: rejected. Drawings must stay sharp at every scale, and each colour change would need new images.
- **Keep the ornament slots (background tile, divider band, card corners, Share Card frame, illustrations) beside the Рупор design**: rejected (#1501). The design draws none of them, and a layer that every screen and card must make room for, but no Edition fills, is complexity without a use.
- **A PNG native splash with the Edition's motif**: rejected. The design's splash is the red field; a plain colour needs no image per Theme and no rebuild when the art changes.
