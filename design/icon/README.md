# FloodSetu mark

An SOS beacon (orange) riding the crest of a flood wave (lime), sending a signal (two arcs). Brand colours: ground `#13140e`, bone `#f4f3e8`, lime `#ebfc72`, SOS `#ff5a36`.

- `mark.svg` is the full-bleed square. Use it for the iOS app icon (iOS masks the corners) and the maskable PWA icons. Everything sits inside the 80% safe zone.
- `mark-rounded.svg` has rounded corners. It is the favicon (`apps/web/public/icon.svg`).
- `glyph.svg` is transparent and has no ground. It is the in-app header mark (`Mark` image set in the iOS asset catalog).

PNG exports live in `apps/web/public` (apple-touch 180, 192, 512) and `apps/ios/.../AppIcon-1024.png`. The iOS icon is opaque, with no alpha channel, as the App Store requires.
