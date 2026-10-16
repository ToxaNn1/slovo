# Editions supply Decor as vector motifs; the Core draws them in its slots

An Edition describes its Decor as data in `decor/decor.json`: for each Decor slot it fills, one or more motifs. A motif is a small vector drawing on its own grid, made of layers, and each layer is SVG path data with one colour for light and one for dark. The Core owns the slots, their layout and their sizes, and draws the motifs with `react-native-svg`: it repeats a tile across the screen (slot 1), repeats a band on both sides of a centre (slot 2), mirrors one corner into the others (slot 3) and scales an illustration (slots 4, 6 and 7). A contract schema checks the file, and the Core fills every slot the Edition leaves out with its own neutral Decor, which is data in the same shape: a thin line with a dot for the divider, and nothing in the other slots. So an Edition without Decor still looks finished, and the Core knows nothing about embroidery.

The victory illustration (slot 6) is one such motif; the Game's result screen stitches its layers in one after another and fades them with Reduce Motion, so the motion belongs to the Core and the Edition only supplies the drawing.

Decor holds shapes and colours only. Words drawn with Decor, such as the splash's wordmark and tagline, are Edition strings that the Core lays out. The native splash stays a PNG described by `decor/splash.json`, because it is baked into the build before any JavaScript runs; the app's splash then draws slot 7 from the motifs over it, with the mark exactly where the native image was.

## Amendment: the Share Card frame (slot 5) (0.6)

The Share Card frame is one slot with two motifs in the same shape as every slot, light and dark: a band and a corner. The Core draws them on the Share Card at the card's scale, as slots 2 and 3 are drawn: the band repeats across the Story card near its top and, mirrored, near its bottom, and the corner is mirrored into the four corners of the Square card. The Square card's divider is slot 2, so the slot holds nothing for it. The Core's neutral Decor leaves slot 5 empty, so an Edition without it gets a plain card on its background with the watermark. The Ukrainian Edition supplies the zig-zag band of slot 2 and the corner of slot 3.

- **Separate slots for the Story and the Square**: rejected. They are one frame in two formats, and an Edition that draws one would draw the other.
- **Reuse slots 2 and 3 on the Share Card without a slot of its own**: rejected. An Edition could not frame its Share Cards apart from its cards in the app, and the design lists the frame as a slot of its own.

## Considered Options

- **React components per Edition**: rejected. An Edition would ship code and could change layout or behaviour, against ADR 0006.
- **SVG files per slot**: rejected for now. Metro would need an SVG transformer, nothing would check a file before the app runs, and each Theme would need its own copy of every drawing.
- **PNG images**: rejected. Tiles and bands must repeat to any width and stay sharp at every scale, and each colour change would need new images.
