# Auri Ager Framework v1.2.2

This patch addresses all four findings from the HACS submission review.

- Load Breakdown renders entity names, icons and entity IDs as escaped text.
- Markdown expands entity values into text nodes after rendering. Links allow only HTTP(S) or relative URLs.
- Finance updates when sensors configured under `entities` change.
- Container forwards new Home Assistant state to its nested cards.
- README now explains HACS installation and migration from manual resources.

Validation: five browser regression tests fail against v1.2.1 and pass against this release. The JavaScript bundle also passes the Node.js syntax check.

This patch retains the other card implementations from v1.2.1. Later local Flow, Summary and Entity Grid features are reserved for a separate release.
