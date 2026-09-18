---
version: alpha
name: Curve — A little more clarity
description: A calm learning workspace shaped by your own course materials.
colors:
  primary: '#252824'
  on-primary: '#FFFFFF'
  background: '#F5F8F5'
  surface: '#FFFFFF'
  on-surface: '#252824'
  muted: '#687062'
  border: '#E8ECE5'
  accent: '#E2DEFA'
  info: '#DCEFF9'
  success: '#E4F5CF'
  warning: '#F8E8D9'
  error: '#A53E36'
typography:
  display:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 72px
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: '-0.055em'
  heading:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 36px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: '-0.045em'
  title:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: '-0.045em'
  body:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  small: 12px
  panel: 22px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  section: 80px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.body}'
    rounded: '{rounded.small}'
    padding: '{spacing.md}'
  button-primary-hover:
    backgroundColor: '{colors.on-surface}'
    textColor: '{colors.on-primary}'
    typography: '{typography.body}'
    rounded: '{rounded.small}'
    padding: '{spacing.md}'
  button-disabled:
    backgroundColor: '{colors.border}'
    textColor: '{colors.muted}'
    typography: '{typography.body}'
    rounded: '{rounded.small}'
    padding: '{spacing.md}'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.on-surface}'
    typography: '{typography.body}'
    rounded: '{rounded.small}'
    padding: '{spacing.md}'
  input-focus:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.on-surface}'
    typography: '{typography.body}'
    rounded: '{rounded.small}'
    padding: '{spacing.md}'
  panel:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.on-surface}'
    typography: '{typography.body}'
    rounded: '{rounded.panel}'
    padding: '{spacing.md}'
  course-card:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.on-surface}'
    typography: '{typography.body}'
    rounded: '{rounded.panel}'
    padding: '{spacing.md}'
  status-chip:
    backgroundColor: '{colors.success}'
    textColor: '{colors.on-surface}'
    typography: '{typography.body}'
    rounded: '{rounded.pill}'
    padding: '{spacing.md}'
---

# Curve Design System

## Overview

Curve serves students studying across multiple university courses. The supplied dashboard image sets the visual direction: an airy canvas, white panels, charcoal controls, and pastel course cards. The product should feel approachable and focused. Avoid invented scores, aggressive urgency, or competitive leaderboards without real evidence.

## Colors

Charcoal carries text and primary actions; white surfaces separate work from the pale canvas. Pastels identify course cards and quiet contextual states, always with dark text. Use muted text only on light neutral surfaces and keep essential instructions readable. Practice and independent checks have distinct chart colors and text labels.

## Typography

Inter creates a consistent, practical reading surface. Display type is reserved for the landing page; headings introduce one task at a time. Mobile headings scale down without changing hierarchy. Source excerpts and question text use comfortable line height and normal letter spacing.

## Layout

Use generous section spacing on the landing page and a comfortable grid in the workspace. The desktop dashboard places course cards beside activity and the next study action. A narrow icon rail supplements labeled top navigation. On phones, stack panels and keep actions reachable without horizontal scrolling.

## Elevation & Depth

Panels use subtle borders instead of heavy shadows. The landing product preview has a restrained diffuse shadow to establish depth. Dialogs use a dim backdrop and clear edges. Do not use perspective transforms on the live workspace.

## Shapes

Panels use the large radius and controls use the smaller radius. Pills are reserved for short labels and mode indicators. Course cards are soft rectangles with consistent padding. Avoid excessive rounded decoration that competes with study content.

## Components

Primary buttons use charcoal with white text, while secondary buttons use white with a subtle border. Disabled controls remain visibly distinct and keyboard focus uses a clear outline. Cards expose explicit practice, independent-check, and edit actions. Inputs have persistent labels, dialogs trap focus, and error states retain entered work.

## Do's and Don'ts

Do:
- Use real session evidence for progress.
- Label sample data clearly.
- Keep source excerpts beside answer explanations.
- Support keyboard navigation and narrow screens.
- Separate practice from independent checks.

Don't:
- Promise exam grades from generated practice.
- Restrict the product to a fixed three-subject catalog.
- Display fake users, testimonials, or achievements.
- Place light text on pastel surfaces.
- Hide loading failures or erase student drafts.
