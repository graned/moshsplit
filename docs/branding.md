# MoshSplit Branding & Theme

> **Last Updated**: 2026-05-11

---

## Overview

MoshSplit uses a **metal/rock themed** visual identity that reflects its core philosophy: transparent expense splitting for chaotic friend groups. The brand combines dark, aggressive aesthetics with functional clarity.

### Brand Personality

| Attribute | Value |
|-----------|-------|
| **Tone** | Bold, transparent, unapologetic |
| **Theme** | Metal/rock concert aesthetic |
| **Accent Color** | Blood red (#DC2626) |
| **Primary Text** | Light gray (#F9FAFB) |
| **Background** | Dark charcoal (#1F2937) |

---

## Color Palette

### Primary Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Blood Red** | `#DC2626` | Primary accent, CTAs, "Split" in logo |
| **Light Gray** | `#F9FAFB` | Primary text, "Mosh" in logo |
| **Dark Charcoal** | `#1F2937` | Secondary background, cards |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Success** | `#10B981` | Green — paid/settled items |
| **Warning** | `#F59E0B` | Amber — pending settlements |
| **Error** | `#EF4444` | Red — unpaid balances, validation errors |
| **Info** | `#3B82F6` | Blue — informational badges |

### Background Hierarchy

| Level | Hex | Usage |
|-------|-----|-------|
| **Page Background** | `#111827` | Full page background (darker) |
| **Card Background** | `#1F2937` | Content cards, panels |
| **Elevated** | `#374151` | Hover states, modals |

---

## Logo Configuration

### Logo Structure

The MoshSplit logo is an SVG rendering that displays:

```
┌────────────────────────────────────┐
│  MoshSplit                        │
│  ────────  ───────                 │
│   Light    Red                     │
│  (#F9FAFB) (#DC2626)              │
└────────────────────────────────────┘
```

- **"Mosh"** — Light gray (#F9FAFB), Impact font, 28px
- **"Split"** — Blood red (#DC2626), Impact font, 28px

### Logo Implementation

The logo is configured in `apps/web/src/App.tsx` via the `SentinelAuthProvider` theme prop:

```tsx
const moshSplitTheme = {
  appName: 'MoshSplit',
  tagline: 'Split expenses. Not ribs.',
  copyright: '© 2026 MoshSplit. All rights reserved.',
  primaryColor: '#DC2626',   // Blood red
  secondaryColor: '#1F2937', // Dark charcoal
  logo: (
    <svg width="120" height="50" viewBox="0 0 120 50" fill="none">
      <text fill="#F9FAFB">Mosh</text>
      <text fill="#DC2626">Split</text>
    </svg>
  ),
};
```

### BrandPanel Behavior

The `BrandPanel` component (from `sentinel-auth-react`) handles logo display as follows:

| Condition | Display |
|-----------|---------|
| No custom logo provided | Shows Sentinel shield icon + "AppName Auth" wordmark |
| Custom logo provided | Shows custom logo only (no wordmark/suffix) |

> **Note**: When passing a custom `logo` to the theme, the BrandPanel hides the wordmark entirely. This prevents "MoshSplit Auth" — the custom logo already contains the full brand name.

---

## Theme Configuration Reference

### SentinelAuthProvider Theme Options

The `SentinelTheme` type supports the following branding options:

| Property | Type | Description |
|----------|------|-------------|
| `appName` | `string` | Application name displayed in auth pages |
| `tagline` | `string` | Short description shown below the logo |
| `copyright` | `string` | Footer copyright text |
| `primaryColor` | `string` | Primary accent color (hex) |
| `secondaryColor` | `string` | Secondary color (hex) |
| `logo` | `ReactNode` | Custom logo component (SVG preferred) |

### Example Full Theme Configuration

```tsx
const moshSplitTheme = {
  appName: 'MoshSplit',
  tagline: 'Split expenses. Not ribs.',
  copyright: '© 2026 MoshSplit. All rights reserved.',
  primaryColor: '#DC2626',
  secondaryColor: '#1F2937',
  logo: (
    <svg width="120" height="50" viewBox="0 0 120 50">
      <text fill="#F9FAFB">Mosh</text>
      <text fill="#DC2626">Split</text>
    </svg>
  ),
};
```

---

## Taglines

| Context | Tagline |
|---------|---------|
| Auth pages | "Split expenses. Not ribs." |
| Landing (future) | "Never hide the math." |

---

## File References

| File | Purpose |
|------|---------|
| `apps/web/src/App.tsx` | Theme configuration + logo SVG |
| `packages/sentinel-auth-react/src/components/ui/BrandPanel.tsx` | Auth page brand panel (handles logo visibility) |
| `packages/sentinel-auth-react/src/types.ts` | `SentinelTheme` type definition |

---

## Design Principles

1. **Contrast**: Always ensure text is readable against backgrounds. Use light text on dark backgrounds.
2. **Accent Usage**: Use blood red sparingly — reserved for CTAs, important labels, and the "Split" portion of the logo.
3. **Transparency**: The UI should feel honest and direct — no hidden math, no deceptive patterns.
4. **Function First**: Aesthetics support usability, not distract from it.

---

*Related: [Architecture Overview](./architecture/overview.md) · [Frontend Agent](../.opencode/agents/frontend/AGENT.md)*