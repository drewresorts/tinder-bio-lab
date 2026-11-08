# TV Static Morph for Shopify

A Shopify theme with an RGB TV static section. The static particles fly together into a halftone version of your transparent PNGs or logos, hold for a while, and scatter back into noise.

This repo is a complete theme: Shopify's free [Dawn](https://github.com/Shopify/dawn) theme (v16.1.1) with the TV static section added and placed at the top of the home page. Because it is a full theme with the standard folder structure, you can connect it straight from GitHub.

- **Static** is per-pixel uniform RGB noise, statistically matched to the reference image: mean value about 127 and mean saturation 0.67.
- **The image** is "transcoded" into a halftone screen: a rotated grid of dots whose size follows the PNG's transparency (or its brightness). Every dot is a static particle that started in a random cell of the noise and flew there.
- **The cursor** scrambles the image back into static wherever it passes.

## What was added to Dawn

```
assets/tv-static-morph.js          <tv-static-morph> custom element (the engine, no dependencies)
sections/tv-static-morph.liquid    Theme section with editor settings and image blocks
templates/index.json               Home page: TV static section added above Dawn's banner
templates/page.tv-static.json      Page template: full-screen TV static, then the page content
demo/index.html                    Local playground (Shopify ignores this folder)
```

Everything else is unmodified Dawn 16.1.1, minus its `.github` CI workflows.

## Install

### Option A: connect this repo as a theme

1. In Shopify admin go to **Online Store → Themes**.
2. Under **Theme library**, choose **Add theme → Connect from GitHub**.
3. Pick this repository and the `main` branch.
4. The theme appears in your library unpublished, so your live store is unchanged. Click **Customize**, then **Publish** when you're happy with it.

Shopify keeps the theme and branch in sync both ways. Pushes to the branch update the theme, and edits in the theme editor are committed back to the branch by Shopify.

### Option B: add the section to your current theme

If you already have a customized theme, copy just two files into it:

1. Go to **Online Store → Themes → ⋯ → Edit code**. Duplicate the theme first if you want a backup.
2. **Assets → Add a new asset → Create a blank file**. Name it `tv-static-morph.js` and paste in `assets/tv-static-morph.js`.
3. **Sections → Add a new section**. Name it `tv-static-morph` and replace its contents with `sections/tv-static-morph.liquid`.
4. In the theme editor, choose **Add section → TV static morph**.

The section only uses its own styles, so it works in any Online Store 2.0 theme.

## Use it

- **Home page:** the section is already first on the home page. Open **Customize** and select **TV static morph** to add images and adjust settings.
- **Its own page:** go to **Online Store → Pages → Add page** and set **Theme template** to `tv-static`.
- **Anywhere else:** in the theme editor, choose **Add section → TV static morph**.

Add one **Image** block per image. With several images it cycles: static → image 1 → static → image 2 → … When you select a block in the editor, the preview morphs to that image and holds it.

If no image is set, the section renders the **Fallback text**, or your store name, so it never looks empty.

### Image tips

- **Use transparent PNGs** (WebP and SVG also work). Transparent areas stay as static, and partly transparent areas give smaller halftone dots.
- **Trim the empty margins** around the artwork. The image is fitted by its full canvas, padding included.
- **Upload at least 1200 px wide.** The section requests a 1600 px version from Shopify's CDN.
- **For photos or JPGs** (no transparency), set **Dot size follows** to **Brightness** or **Darkness**.
- **Dark logos:** the default **Dot color: Static** only uses the shape, so any logo color works on any background. With **Original image colors**, colors too close to the background (like a black logo on black) are lightened automatically so they stay visible.

## Settings

| Group | Setting | What it does |
| --- | --- | --- |
| Layout | Height (desktop / mobile) | Section height in viewport units |
| | Background color | Shows through once the image has formed |
| Static | Static pixel size | Size of each noise pixel. 1–2 px is closest to the reference. |
| | Static color | 0% is black-and-white static. 100% is full RGB. |
| | Flicker speed | How often the noise re-rolls, in fps |
| | CRT effects | Scanlines, vignette, a rolling brightness band and occasional line tearing |
| Image | Image size | How much of the section the image may fill |
| Halftone | Dot spacing | Distance between dots. The playground also shows it as print LPI. |
| | Dot size | 100% means full-tone dots just touch |
| | Screen angle | Rotation of the halftone grid. Print convention is 45°. |
| | Dot shape | Round (print halftone) or square (pixel). Particles leave the static as squares and land as this shape. |
| | Dot size follows | Transparency (logos), Brightness or Darkness (photos) |
| Image color | Dot color | Static (RGB noise), Original image colors, or a custom color |
| | Static grain in image | How much noise remains in image or custom colors |
| | Background static when formed | How bright the surrounding static stays while the image is held |
| Motion | Playback | Loop, play once and hold, form on hover or tap, or form as you scroll |
| | Static before each image, Morph duration, Image hold | Timeline in seconds |
| | Arrival pattern | Random, scan (top to bottom), sweep (left to right), or center out |
| | Stagger, Swirl, Particle travel | Shape of each particle's flight. Low travel condenses the image out of nearby static. |
| | Cursor scrambles the image, Cursor radius | Cursor interaction |
| Text overlay | Heading, text, button, position, color | Optional content over the effect |

## Try it locally

Open `demo/index.html` in a browser; no server is needed. It loads the same engine and starts with three sample images. You can drop your own PNGs onto the screen or use **Add PNGs**. Files stay in the browser.

Each control uses the same label as the theme editor. **Copy settings for Shopify** copies a list of your values to the clipboard so you can copy them over.

## Use it outside the section

The engine is a standard custom element, so it also works in a Custom Liquid block:

```html
<tv-static-morph style="display:block;height:80vh" data-dot-spacing="5" data-playback="loop">
  <img data-tsm-source src="logo.png" alt="Brand logo" crossorigin="anonymous">
</tv-static-morph>
<script src="{{ 'tv-static-morph.js' | asset_url }}" defer></script>
```

Every option is a `data-*` attribute; see the `OPTIONS` block at the top of the JS file. Attributes can be changed live. The JS API is:

- `el.setImages([urls | <img> | <canvas> | ImageBitmap])` replaces the images.
- `el.goTo(index, hold)` morphs to one image; `el.release()` lets playback continue.
- `el.progress` reads the morph position, or sets it when `data-playback="manual"`.
- A `tsm:phase` event fires on `static`, `forming`, `image` and `dissolving`.

Images on other domains must send CORS headers so their pixels can be read. Images uploaded to Shopify already do.

## Performance and accessibility

- **Rendering:** two draw calls per frame. The static is a full-screen shader; the image dots are GPU point sprites.
- **Particle cap:** 140k on desktop, 45k on touch devices. The dot spacing widens automatically if an image would exceed it.
- **Pausing:** rendering stops while the section is off-screen, and device pixel ratio is capped at 2.
- **`prefers-reduced-motion`:** the image is shown fully formed over still static, with no flicker.
- **Screen readers:** the canvas is hidden from them; the source `<img>` elements stay in the DOM, visually hidden, with their alt text.
- **No WebGL:** the first image is shown as a normal image.

## Testing status

- **Theme linter:** Shopify's `theme-check`, run with Dawn's own config, finds nothing in the added files. The 9 findings it reports for the whole theme are all in stock Dawn and identical to a clean Dawn 16.1.1 checkout.
- **Schema:** a script also checked every schema range, default, select option, and the setting → `data-*` → engine wiring.
- **Engine:** tested in headless Chromium using software WebGL, at desktop and phone sizes. That covered loop, once, hover, manual and reduced-motion playback, uploads, resizing, re-attaching after an editor reload, and theme-editor block selection.
- **Not yet tested** in a live Shopify store, in Safari or iOS, or on real GPUs. Check it in the unpublished theme preview before publishing.

## License

Dawn is © Shopify Inc. under the license in `LICENSE.md`, which allows building themes for Shopify. The TV static section, engine and playground were added on top.
