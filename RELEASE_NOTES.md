# Auri Ager Framework v1.2.3

This patch addresses the three remaining configuration escaping findings from the HACS review.

- Entities caption labels are escaped before being inserted into HTML.
- Sun titles are assigned with `textContent`, preserving their literal text.
- Sun background URLs are assigned with `setAttribute`, preventing quotes from injecting SVG event handlers.

Three new browser regression tests reproduce the findings against v1.2.2 and pass against this release. All eight HACS regression tests and the JavaScript syntax check pass.

Default and hidden titles, normal image URLs, image clipping and existing layouts are preserved. This release retains the earlier v1.2.2 fixes.
