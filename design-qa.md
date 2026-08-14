# Design QA — YUNGCHENG PA YCT1 15 × 940

- Source visual truth: `/var/folders/zw/89yk_8ms767d3kg8zyjh51vr0000gn/T/codex-clipboard-8a8b20a8-de88-4874-8e1f-2dcbf7f13cff.png`
- Implementation: `app/html-template/YUNGCHENG_PA_YCT1_15_X_940.html`
- Implementation screenshot: `implementation-yungcheng-pa-yct1.png`
- Full-view comparison: `design-qa-comparison-yungcheng-pa-yct1.png`
- Focused footer comparison: `design-qa-footer-comparison-yungcheng-pa-yct1.png`
- State: static print label, default state

## Capture normalization

- Source pixels: 1032 × 1192.
- Implementation pixels: 1032 × 1192.
- CSS canvas: 1032 × 1192, with a 1004 × 1162 sheet and a 980 × 937 bordered label region.
- Browser viewport during the final full-page render: 1280 × 720; the fixed-size label canvas was cropped to its exact 1032 × 1192 bounds without resampling.
- Density normalization: 1 implementation pixel compared with 1 source pixel. The combined full-view comparison displays both sides at 50% only to fit them into one 1032 px-wide comparison image.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: hierarchy, serif/sans-serif split, weights, wrapping, and large value sizing match the source. Chinese glyph contours vary slightly with the host system fonts; this is acceptable P3 variation.
- Spacing and layout rhythm: outer frame, header, grid boundaries, column widths, row heights, QR placement, and footer partitions align with the source.
- Colors and visual tokens: dark frame, white header, pale blue body, blue rules, and blue captions visually match the source.
- Image quality and asset fidelity: both QR codes and the production-license logo use lossless crops from the supplied source image; all three load at their native dimensions without console errors.
- Copy and content: all product values, company details, material, date, shelf-life, grade, and inspection content are present.

The grey dropdown-like overlay visible in the source footer was treated as a transient capture artifact, not printed label content, and was intentionally omitted.

## Focused region comparison

The footer was compared at 1:1 width in `design-qa-footer-comparison-yungcheng-pa-yct1.png`. Company text, date, shelf-life, inspector area, borders, and bottom alignment remain visible and unclipped. The inspector marks use available text glyphs, with only minor P3 glyph-shape variation from the source.

## Comparison history

1. Initial pass found P2 drift in header title width/position, QR scale, footer spacing, and clipped inspector approval text.
2. The title size and offsets were adjusted, QR assets were resized and repositioned, footer spacing was rebalanced, and inspector line height was reduced.
3. Post-fix evidence in the final full-view and focused footer comparisons shows matching geometry and no clipped content. Unit weights were then reduced to match the source's lighter `mm` and `m` styling.

## Browser verification

- HTML opened successfully from the local preview server.
- All three referenced images loaded successfully at native dimensions.
- No browser console warnings or errors were present.
- Primary interactions tested: none; the artifact is intentionally a static print label.

## Follow-up polish

- P3: bundle a specific licensed Chinese typeface if identical glyph outlines are required across machines.
- P3: replace the inspector text glyphs with an approved source asset if the handwritten mark must be exact.

final result: passed
