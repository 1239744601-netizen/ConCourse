# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

ConCourse serves university students planning a semester, researching courses, sharing campus knowledge, exchanging approved study materials, and building trusted connections with verified students.

The primary timetable user is a signed-in student deciding which offered courses and meeting sections can fit one upcoming semester without time conflicts.

## Product Purpose

ConCourse brings course discovery, semester planning, timetable generation, academic tools, verified campus community, messaging, and a moderated campus market into one student platform.

For timetable planning, success means a student can enter or import real course details, set personal constraints, compare conflict-free schedules, and save a final semester timetable.

## Positioning

ConCourse links course understanding, semester decisions, and verified campus participation. The saved timetable becomes useful context for community, academic insight, and future student services instead of remaining an isolated planning artifact.

## Operating Context

Students use ConCourse before and during course registration. They may start from the Course Explorer or Course Selection Assistant, import a shortlist, complete missing credits and meeting times manually, rank timetable options, and save one final schedule.

The product supports English, Simplified Chinese, and Traditional Chinese, plus day and night themes. The current production surface is a static web application backed by Supabase services.

## Capabilities and Constraints

- Preserve account, profile, language, theme, saved planner state, Course Explorer, Course Selection Assistant, Student Hub, CourseKeys, and timetable-generation behavior.
- Semester planning accepts manually entered course identity, credits, required-course status, weekly meeting options, preferred free days, time limits, breaks, and course-count constraints.
- Imported assistant choices remain tied to the active account and are removed from the one-time handoff after import.
- The generated timetable must remain conflict-aware, ranked, printable, and saveable as the student's final timetable.
- Verification, moderation, storage, payment, and marketplace safety controls must not be represented as active before their backend enforcement is complete.
- Existing routes, control IDs, persisted state keys, analytics-sensitive labels, and Supabase contracts are compatibility constraints.
- Do not push, deploy, or execute live database SQL without explicit approval.

## Timetable Rebuild Phase

The first rebuild release exposes Timetable only. Its visible product path is the FAN-T111 entrance, the continuous mechanical traversal, course and meeting construction, semester constraints, ranked timetable generation, and account-backed save behavior. Course Search, Student Hub, Campus Community, Campus Market, Messages, Academic Tools, and Academic Insights keep their existing source and data contracts but have no visible entry in this rebuild phase. They will be reconsidered only after the Timetable interaction is validated.

The hidden Assistant handoff remains readable for backward compatibility with an existing same-tab selection payload, but the rebuild does not advertise or navigate to the Assistant. No unrelated feature is deleted and no production or Supabase state is migrated in this phase.

## Brand Commitments

The product name is ConCourse. For the competition redesign, the former deep-navy landing world is retired. The timetable entrance establishes the new visual authority: soot black, neutral graphite, brushed metal, warm white, and a restrained amber mechanical status accent. On a motion-capable desktop, the FAN-T111 exterior and vent threshold are modeled geometry rather than a photo-textured shell; raster references are reserved for explicit fallback or art-direction use. The live timetable remains semantic DOM content above that geometry. No previous blue landing artwork, blue loading state, or blue control treatment may appear in this journey. Other routes keep their current behavior and are migrated only when they are redesigned in their own scoped iteration.

## Evidence on Hand

- Existing working product and planner implementation in `index.html`.
- Existing timetable logic and persisted state in the main client script inside `index.html`.
- Approved initial timetable reference represented by `concourse-timetable-monitor-blank-v1.png`; production desktop motion reconstructs it as geometry and reserves the image for explicit fallback paths.
- Existing timetable presentation, interaction, and geometry layers in `timetable-immersive.css`, `timetable-immersive.js`, and `timetable-machine-3d.mjs`.
- Automated contracts under `tests/`, including timetable immersion, planner stability, navigation, language, accessibility, and build-copy checks.

No verified customer claims, usage benchmarks, payment guarantees, or institutional redistribution permissions are available and none should be fabricated.

## Product Principles

1. Keep complex planning understandable at first glance.
2. Make every visual interaction support a real student decision.
3. Preserve user trust through explicit verification and privacy boundaries.
4. Let course research, planning, and community context reinforce one another.
5. Prefer accessible, responsive, resilient behavior over decorative novelty.

## Accessibility & Inclusion

Keyboard operation, visible focus, semantic labels, sufficient contrast, reduced-motion behavior, forced-colors support, responsive layouts, and multilingual text expansion are required. Motion may enhance orientation but must never gate planner content or actions. If static fallback is selected, the cinematic overlay must release its occlusion so the established planner is immediately usable.
