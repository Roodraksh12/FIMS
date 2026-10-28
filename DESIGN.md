---
name: FIMS Campus Portal
description: Practical local faculty induction records
colors:
  ink: "#233448"
  primary: "#285379"
  primary-hover: "#1d3e5e"
  muted: "#657080"
  sidebar: "#f3f5f7"
  selected: "#e2e9f1"
  surface: "#ffffff"
  canvas: "#fafbfc"
  border: "#dfe3e8"
  institute-accent: "#d77736"
typography:
  family: '"Segoe UI", Arial, sans-serif'
  page-title: 28px
  section-title: 17px
  task-name: 14px
  body: 15px
  supporting: 12px
rounded:
  panel: 6px
  control: 4px
---

# FIMS campus portal

The user requested a less AI-generated interface. The revised direction is a practical institute portal: ordinary language, real faculty records and dates, fewer decorative panels, and a clear distinction between work needing attention and reference information.

## Layout

A light, narrow navigation rail carries the supplied LNMIIT logo. Muted blue actions and a small orange accent relate to the logo without claiming an official institute design standard. The faculty overview begins with identity, joining date and target date, then outstanding tasks. Completion counts and mentor contact details sit alongside the work rather than occupying a hero panel. The complete checklist follows below. HR and HOD use concise worklist headings.

## Type and copy

Use local Segoe UI/system sans throughout operational screens. Serif type is reserved for the certificate document. Titles name the page or task. Avoid motivational taglines, chapter/journey metaphors, oversized percentage displays, padded counters and generic encouraging copy. Feedback should say what changed, who must act, or what prevents completion.

## Colour and components

`src/styles.css` provides the shared structural and responsive base. `src/campus.css`, imported afterward, owns the current colour, typography, component finish and faculty/login compositions. Its final mobile rules take precedence. The existing `--green` variable is retained as a compatibility alias to `--primary`; it no longer specifies a green brand colour.

Panels have light borders, small corners and no decorative shadow. Status badges retain text as well as colour. Progress bars support exact task counts. Icons identify actions or document categories; coloured icon tiles are not a repeating layout device. Forms preserve visible labels, validation, focus outlines, busy/disabled states and native dialog behavior.

## Responsive behavior

Desktop uses a work column and compact details column. Below 900px, progress and mentor details move below outstanding work; at phone width they stack. The navigation becomes a drawer at 700px. Tables scroll within their containers. Form controls retain at least 44px height on phones. Reduced-motion settings continue to apply.

## Evidence and limits

The update changes UI composition and copy only. It preserves persisted records and service permissions, validation and state transitions. The production build and all 27 service tests passed. The current sign-in, faculty dashboard, HR overview, document screen and upload dialog were inspected in the running in-app browser; phone layout and navigation were checked at 375px without document overflow. Existing browser test headings were updated for the new copy; the full browser suite was not rerun for this visual-only update.

## Role-specific dossier pages

The same underlying record has separate role-oriented compositions: faculty has a personal submission status, blockers and feedback; HR has a searchable/filterable multi-faculty worklist plus document/mentor/training clearance review; HOD has consolidated evidence and final decision controls. Shared data does not imply an identical screen. Component source: `src/DossierPages.tsx`, routed by role in App. Styles in `src/campus.css` stack staff clearance panels and submission stages on phones. At widths below 420px, the header omits the redundant page caption to preserve space for account switching; the full page heading remains visible below.
