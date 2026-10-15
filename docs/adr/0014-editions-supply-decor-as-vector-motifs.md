# Editions supply Decor as vector motifs; the Core draws them in its slots

An Edition describes its Decor as data in `decor/decor.json`: for each Decor slot it fills, one or more motifs. A motif is a small vector drawing on its own grid, made of layers, and each layer is SVG path data with one colour for light and one for dark. The Core owns the slots, their layout and their sizes, and draws the motifs with `react-native-svg`: it repeats a tile across the screen (slot 1), repeats a band on both sides of a centre (slot 2), mirrors one corner into the others (slot 3) and scales an illustration (slots 4, 6 and 7). A contract schema checks the file, and the Core fills every slot the Edition leaves out with its own neutral Decor, which is data in the same shape: a thin line with a dot for the divider, and nothing in the other slots. So an Edition without Decor still looks finished, and the Core knows nothing about embroidery.

The victory illustration (slot 6) is one such motif; the Game's result screen stitches its layers in one after another and fades them with Reduce Motion, so the motion belongs to the Core and the Edition only supplies the drawing.

Decor holds shapes and colours only. Words drawn with Decor, such as the splash's wordmark and tagline, are Edition strings that the Core lays out. The native splash stays a PNG described by `decor/splash.json`, because it is baked into the build before any JavaScript runs; the app's splash then draws slot 7 from the motifs over it, with the mark exactly where the native image was.

## Considered Options

- **React components per Edition**: rejected. An Edition would ship code and could change layout or behaviour, against ADR 0006.
- **SVG files per slot**: rejected for now. Metro would need an SVG transformer, nothing would check a file before the app runs, and each Theme would need its own copy of every drawing.
- **PNG images**: rejected. Tiles and bands must repeat to any width and stay sharp at every scale, and each colour change would need new images.
