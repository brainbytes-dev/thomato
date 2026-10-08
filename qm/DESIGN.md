---
name: Swiss Clinical Minimalism
colors:
  surface: '#ffffff'
  surface-dim: '#d0daf0'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8fe'
  surface-container-highest: '#d9e3f8'
  on-surface: '#121c2b'
  on-surface-variant: '#424752'
  inverse-surface: '#273141'
  inverse-on-surface: '#ebf1ff'
  outline: '#727783'
  outline-variant: '#c2c6d4'
  surface-tint: '#1a5db3'
  primary: '#003b7d'
  on-primary: '#ffffff'
  primary-container: '#0052a8'
  on-primary-container: '#aec9ff'
  inverse-primary: '#abc7ff'
  secondary: '#345e9f'
  on-secondary: '#ffffff'
  secondary-container: '#8fb7fd'
  on-secondary-container: '#164686'
  tertiary: '#6b2800'
  on-tertiary: '#ffffff'
  tertiary-container: '#903901'
  on-tertiary-container: '#ffb999'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#abc7ff'
  on-primary-fixed: '#001b3f'
  on-primary-fixed-variant: '#00458f'
  secondary-fixed: '#d6e3ff'
  secondary-fixed-dim: '#aac7ff'
  on-secondary-fixed: '#001b3e'
  on-secondary-fixed-variant: '#154685'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb694'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#eef2f9'
  on-background: '#121c2b'
  surface-variant: '#d9e3f8'
  surface-secondary: '#f3f6fb'
  sidebar: '#f7f9fd'
  text-muted: '#4d5f7d'
  border: '#dde5f0'
  border-field: '#8095b3'
  critical-red: '#b3261e'
  warning-ochre: '#8a5a00'
  success-green: '#1a6b3c'
typography:
  display: {fontFamily: Inter, fontSize: 34px, fontWeight: '600', lineHeight: 42px, letterSpacing: -0.02em}
  display-mobile: {fontFamily: Inter, fontSize: 28px, fontWeight: '600', lineHeight: 34px, letterSpacing: -0.015em}
  headline-section: {fontFamily: Inter, fontSize: 23px, fontWeight: '600', lineHeight: 30px, letterSpacing: -0.01em}
  headline-subsection: {fontFamily: Inter, fontSize: 18px, fontWeight: '600', lineHeight: 24px, letterSpacing: -0.005em}
  body-default: {fontFamily: Inter, fontSize: 15px, fontWeight: '400', lineHeight: 22px}
  body-emphasis: {fontFamily: Inter, fontSize: 15px, fontWeight: '600', lineHeight: 22px}
  label-default: {fontFamily: Inter, fontSize: 14px, fontWeight: '500', lineHeight: 20px}
  meta-default: {fontFamily: Inter, fontSize: 13px, fontWeight: '400', lineHeight: 18px}
  meta-mono: {fontFamily: JetBrains Mono, fontSize: 13px, fontWeight: '500', lineHeight: 18px}
  badge: {fontFamily: Inter, fontSize: 12px, fontWeight: '600', lineHeight: 16px, letterSpacing: 0.02em}
rounded: {sm: 0.125rem, DEFAULT: 0.25rem, md: 0.375rem, lg: 0.5rem, xl: 0.75rem, full: 9999px}
spacing: {gutter: 1rem, gutter-desktop: 1.5rem, margin: 1rem, margin-desktop: 2rem, space-xs: 0.25rem, space-sm: 0.5rem, space-md: 1rem, space-lg: 1.5rem, space-xl: 2rem}
---

# Design System: Swiss Clinical Minimalism

**Status:** verbindliche Designleitlinie (Stitch-Export vom 17. September 2026, Henrik).
**Produktname im Code bleibt `QM Rettungsdienst`** (die Quelle trägt den Arbeitstitel «Thomato IVR QM»). Keine IVR-Claims in der Oberfläche.

## 1. Dials

- DESIGN_VARIANCE: 0.2
- MOTION_INTENSITY: 0.1
- VISUAL_DENSITY: 0.6

## 2. Richtung

- Deep Clinical Blue #0052A8 als Marken- und Interaktionsfarbe, Primary deep #003B7A.
- Background #EEF2F9, Surface #FFFFFF, Secondary surface #F3F6FB, Sidebar #F7F9FD, Text #050F1E, Muted #4D5F7D, Border #DDE5F0, Field-border #8095B3.
- Critical #B3261E, Warning ochre #8A5A00, Success #1A6B3C.
- Dezente Radien (3 px Badges, 4 px Buttons/Inputs, 6 bis 7 px Container).
- Typografie: Inter plus JetBrains Mono für Daten, tabular nums, zurückhaltende Hierarchie (Display ~34 px, Section ~23 px, Body ~15 px, Meta ~13 px).
- Keine Schatten ausser echter Elevation (Dropdowns, Dialoge). Linien und Abstand strukturieren.

## 3. Regeln

Rot nie als Markenfarbe. Readiness ist ein qualitativer Status, getrennt vom Prozentwert. Nach dem Status folgt «Braucht Aufmerksamkeit». Status immer mit Textlabel, nie nur Farbe. Icons: lucide-react, keine Emojis. 4/8-px-Raster, `:focus-visible` auf allem Interaktiven. Farben im Code nur über Tokens aus `globals.css`.

## 4. Dark

background #050F1E, surface #0A1830, surface-subtle #102341, sidebar #040C18, text #EEF5FF, muted #9DB6D8, primary #3C8CFF, critical #FF9B91, warning #E0B45C, success #76D3A1.
