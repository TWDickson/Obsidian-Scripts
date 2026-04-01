# TTasks Styling Notes

## Obsidian variable usage

Use Obsidian semantic variables for plugin UI so components adapt to themes:

- Surface and borders: --background-primary, --background-secondary, --background-modifier-border, --background-modifier-border-focus
- Text: --text-normal, --text-muted, --text-faint, --text-on-accent
- Interactive: --interactive-accent, --interactive-accent-hover
- Status colors: --color-red, --color-orange, --color-blue, --color-green

Avoid hard-coded colors for text on status/accent surfaces. Prefer semantic text tokens over hex literals.

## Mobile modal fixes (implemented)

Create modal fixes for keyboard usability and sideways scrolling:

- Full-screen modal pinned with fixed inset layout.
- Modal container horizontal overflow clipped.
- Modal content constrained to width 100 percent with overflow-x hidden.
- Vertical scroll uses overscroll-behavior contain and touch scrolling.
- Action row made sticky at bottom with safe-area padding.
- Added min-width guards for modal subtree and wrapping for chips.

## Practical rules

- Prefer token-based hover states over CSS filter brightness.
- Prefer focus token --background-modifier-border-focus for control focus rings.
- For opacity overlays and shadows, prefer rgba(var(--mono-rgb-100), alpha) over fixed black RGBA values.
- Keep !important only where Obsidian specificity requires it.

## Regression checklist

When changing modal styles, verify on phone:

1. Opening keyboard does not hide primary actions.
2. Modal can scroll vertically while keyboard is open.
3. Modal content cannot scroll sideways.
4. Long labels/chips wrap instead of forcing horizontal overflow.
5. Safe-area spacing is correct at the bottom.
