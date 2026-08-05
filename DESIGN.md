# ConCourse Design Notes

This document records the approved design system for the timetable scroll journey only. It does not redefine Student Hub, Course Explorer, CourseKeys, authentication, profiles, messaging, marketplace, or any other Concourse surface.

## Timetable Journey Intent

The timetable opens as a real machine that a student can enter, not as a slideshow layered over a product image. Native scrolling moves one continuous perspective camera from the front of the FAN-T111 timetable display, through a lower ventilation aperture with physical depth, and into the scheduling mechanism inside the chassis. Reverse scrolling retraces the same spatial path.

The internal machine is a spatial interpretation of timetable logic:

- five scheduling rails correspond to Monday through Friday;
- course cartridges represent saved courses;
- a central synchronization bus represents user and institution calendar data;
- an amber mechanical latch indicates a time conflict;
- three built-in service mechanisms expose the existing course, meeting, and semester controls.

The cinematic layer is an entry into the real planner. It preserves the established data model, validation, saved state, account scoping, and timetable generation.

## Initial Viewport Contract

The FAN-T111 reference is the complete initial viewport. Before the first authored motion begins, the only visible elements are the ConCourse and Timetable labels, one Account action, the FAN-T111 device, its live five-day timetable, the model label, “Make the week yours.”, the wheel instruction, and the read-only bottom progress rail. No entry to another ConCourse module appears during the Timetable validation phase.

The former deep-blue “Build your best semester” landing page is not a loading layer, authentication gate, background, or transition. The timetable experience is public at arrival. Account authentication appears only when a student invokes an account-dependent action such as Profile or saving protected data. The original planner remains as the functional state engine behind the mechanical controls and must not leak visually underneath the pinned journey.

## Visual Direction

On a motion-capable desktop, the approved world is geometry from the first visible machine frame: Three.js constructs the FAN-T111 enclosure, screen opening, chassis rails, lower grille, threshold, and dense internal machine. `concourse-timetable-monitor-blank-v1.png` is reserved for compact and reduced-motion presentation; it is never cross-faded under the active 3D model. A desktop WebGL failure releases the cinematic layer and restores the semantic planner instead of showing a low-resolution exterior. The generated interior image remains art-direction evidence only and is not loaded as a model texture, photographic relief, or active desktop fallback. Materials are soot-black anodized aluminum, graphite, aged gunmetal, brushed aluminum, smoked mineral glass, braided cable sleeves, copper contacts, precision fasteners, and neutral warm-white work light. A single muted amber diagnostic accent is reserved for conflict and mechanical load. Deep blue, cobalt, cyan glow, and the previous architectural-blue artwork are prohibited throughout the initial, loading, threshold, interior, and generated-timetable states. The generated result is a graphite inspection display with warm-white type and a restrained amber action state. It lives on a fourth, full-width physical carrier that rises from below on twin ground rails and lead screws only after the three editing carriers have returned to their bays. The generated timetable remains live semantic DOM projected into the carrier's measured glass opening; no screenshot, canvas capture, or texture replaces either the interface or machine when the solver succeeds.

The lower cooling grille is one extruded graphite plate. Every perforation, including the selected center opening, is cut from the same shape with the same radius, wall depth, and face/wall material treatment. The center opening is not enlarged, darkened, or replaced by a second hero aperture at the face. Its service bore connects immediately behind the rear face and only then widens into the internal threshold, preserving a believable passage through real front and rear surfaces.

The interior should be complex without becoming arbitrary. Overlapping rails, cable looms, connector banks, circuit backplanes, heat sinks, brackets, compact servos, bearings, idler gears, tensioners, bus bars, cartridge magazines, fasteners, washers, and restrained wear create layered foreground occlusion and parallax. Every visible assembly needs a plausible purpose. No neon gaming palette, retro electronics, steampunk, rust, decorative gear wall, or floating glass cards.

Three editing carriers and one generated-result carrier are built into a shared terminal pressure wall:

- the course carrier rotates from a left vertical hinge, advances on a two-rail telescoping carriage, and settles with a slight inward yaw;
- the meeting carrier mirrors that mechanism from the right with its own bearings, lock, rails, and service drive;
- the semester-constraints carrier begins folded as a horizontal mechanical layer, rotates upward on a full-width hinge, and advances from the lower bay.
- the result carrier is a larger front lift with bored recirculating slide shoes, twin fixed rails, lead screws, a lower saddle, docking feet, a gasketed bezel, and a separate live display anchor.

Each carrier keeps a compact machined rear frame so adjacent assemblies do not intersect. The shared terminal wall, bay apertures, pressure gaskets, hinge knuckles, locks, service gears, cable runs, lift rails, and final retaining bezels remain visible around the controls. Every live HTML surface is projected from four physical carrier corners through a validated CSS homography and inset behind the metal lip. It never enters from a viewport edge, floats above the scene, or substitutes a texture for the real form. During planning, all three editing carriers remain attached and open together. After generation, those carriers close, retract face-forward into their bays, and lock before the larger result terminal enters their former working volume.

## Motion Thesis

This page has one authored motion event: entering the timetable machine. ScrollTrigger maps native scroll to a single monotonic playhead. Three.js renders the real perspective scene and moves the camera along a `CatmullRomCurve3`; it is not a sequence of page swaps or a flat image zoom.

Normalized beats:

- `0.00-0.12`: the live timetable remains readable and establishes the device.
- `0.12-0.22`: page chrome recedes and the camera axis locks to the lower vent.
- `0.24-0.28`: the ordinary center perforation at the device’s `50% / 75.25%` axis becomes the lens without changing face radius, depth, or material.
- `0.27-0.34`: the lens finishes its vertical descent, locks coaxially to the selected aperture, and crosses the rubber seal and first machined bore ring.
- `0.33-0.43`: the front lip, circular liner, elliptical transition, rounded-rect plenum collar, and far mechanical opening pass around the camera as one continuous shell.
- `0.43-0.52`: the exterior falls behind the lens and the first internal bus is revealed without a scene cut.
- `0.48-0.64`: layered internal parts pass the lens and establish the terminal pressure wall at depth.
- `0.64-0.79`: the left lock releases, the course carrier rotates out of its bay, and its short telescoping slide seats.
- `0.74-0.89`: the right-side meeting carrier repeats the linked hinge-and-slide action with a separate rhythm.
- `0.81-0.96`: the lower lock releases, the folded semester carrier rotates upward and advances into its working stop.
- `0.96-1.00`: all three carriers remain open together for cross-reference; exposed reduction gears continue at a low service speed and short, periodic tooth-contact sparks remain visible without becoming decorative fireworks.

Generating a timetable initiates a separate 1.35-second mechanical mode change at the same terminal camera station. It is not another page transition: editing hinges close during mode blend `0.02-0.18`, their slides retract during `0.22-0.34`, latches seat by `0.40`, and the result lift rises only during `0.46-0.96`. The result DOM is enabled after the carrier is essentially docked. Returning to edit reverses the exact scalar trajectory, so no carrier teleports and no forward-only collision workaround is needed.

Camera travel stays forward. Roll is zero, yaw remains restrained, and the spline provides subtle lateral movement only where foreground geometry creates useful parallax. Parts have mass: latches release before trays move, gears turn because a linked mechanism is moving, and stops settle with restrained damping. No `back.out` entrances, repeated fades, or disconnected flourish.

## Figma Storyboard Contract

Figma documents spatial intent and keyframes; production motion remains WebGL and GSAP. Frames use the 1536 by 1024 reference viewport:

1. Front device
2. Vent lock
3. Grille threshold
4. Course cartridge
5. Weekday hinge
6. Scheduling core
7. Constraint tray
8. Generated timetable lift

Each frame records camera position, look target, aperture bounds, light direction, occluding foreground parts, and the corresponding DOM anchor. Smart Animate may be used to review rhythm but is not the production renderer.

## Functional Input Contract

- Course name, code, professor, credits, and the must-take flag synchronize bidirectionally with the original course builder.
- Sessions per week, multiple time options, Monday-through-Saturday selection, start and end times, Add session, Save option, and dynamic remove actions operate on the original pending-session and saved-option arrays.
- Degree level and year of study remain the original generation prerequisites rather than decorative profile fields.
- Minimum and maximum credits, fewest-versus-exact course count, exact course total, free-weekday count, and specific free weekdays all use the original hard-constraint path.
- Compact classes, fewer campus days, avoid-before, avoid-after, and every free-time block use the original ranking inputs and persistence path.
- The mechanical course tray mirrors the live wishlist and delegates removal to the established course cards.
- Adding a course executes the original planner actions rather than creating a parallel store.
- Generate timetable invokes the established solver directly. Continuing enters the detailed planner with its conflict, ranking, save, print, and timetable behavior intact.
- Each tray has a fixed mechanical shell and an independently scrollable semantic HTML body. Scroll is never intercepted globally; the outer journey resumes naturally at a tray boundary.
- Existing IDs, storage keys, language strings, account scope, and analytics-sensitive labels remain compatibility constraints.

## Runtime and Performance

- Three.js is vendored locally; no CDN request is required at runtime.
- GSAP controls one progress value. Three.js derives camera, hinges, telescoping slides, gears, particles, and projected carrier quads from that value.
- Rendering pauses when the journey is inactive or the document is hidden, except while the generated timetable intentionally keeps the settled terminal alive as its inert mechanical surround.
- Stable result mode renders at 30 fps while gear and spark motion still integrate real elapsed time. Scroll, camera, and mode transitions are not frame-capped.
- Carrier projection is dirty-driven: anchors are recomputed only when progress, camera mode, carrier blend, viewport size, or renderer activation changes. Pure idle gear frames do not force DOM homography or style writes.
- Zero-energy phase lights are removed from Three.js's active-light set. Exterior and terminal phases each use one shadow-casting key; secondary work lights retain material response without repeating the entire mechanical scene through redundant shadow maps. Small hardware still receives shadow and material light, while only mechanically substantial parts cast into the high-cost maps.
- Device pixel ratio is bounded by a 4.5-million-pixel fill budget and capped at `1.75` on motion-capable desktop; compact viewports use the static fallback path.
- Geometry and materials are reused. Repeated components use instancing where practical; the grille itself remains one extruded plate with true path-cut through-holes.
- The target is 60 fps on a current desktop, with no layout reads in the render loop.
- No raster exterior or interior surface participates in the motion-capable desktop render. The compact static presentation may use the exterior reference; the interior reference is never sampled by the model.
- A `ResizeObserver` caches each form's untransformed layout size. No panel measurement occurs in the Three.js render loop.
- The projected live DOM surface is applied only when all four corners are finite, in front of the near plane, convex, non-degenerate, camera-facing, inside the viewport safety limit, and at least partially intersecting the viewport. Invalid quads fall back safely instead of producing a giant intermediate frame.

## Accessibility and Resilience

- The WebGL canvas is `aria-hidden`; every course name, time, field, and action remains semantic HTML.
- Editing carriers unlock cumulatively as they seat near the camera. At the planning terminal state, all three remain visible and interactive so a student can compare course, meeting, and semester constraints together. The generated result carrier has its own focusable vertical scroll region and keeps the calendar's horizontal scroll independent.
- Each carrier body is keyboard focusable and independently scrollable; its heading and mechanical frame remain stable while long conditions move inside it.
- A keyboard-visible skip link moves directly to the established planner.
- `prefers-reduced-motion`, Save-Data, forced colors, and viewports at or below 760px receive a normal-flow static form experience with no pinning or camera travel. Desktop WebGL failure or context loss removes journey occlusion and restores the established semantic planner. In either case no unusable cinematic shell remains.
- Motion never gates planner data or the ability to complete the task.

## Mechanical Clearance Contract

Carrier and portal dimensions are a functional contract, not decorative coordinates. The final forward-and-reverse result changeover is sampled across 10,001 scalar positions. Non-intentional overlap count must remain zero. Current minimum verified gaps are `0.140 / 0.140 / 0.160` between the result carrier and course, meeting, and priority carriers; `0.062` from portal to guide standoff; `0.056` from standoff to slide shoe; `0.046` from standoff fastener to shoe; `0.020` from old side wall to result side bar; and `0.031` from slide to lead screw. The `0.013` radial guide-to-bored-slide clearance is an intentional running fit. The result DOM is clipped five pixels inside a `10.06 × 6.36` world opening, keeping roughly `0.0368` world units away from every physical bezel edge.

## Scope Guardrails

- Preserve header, theme, language, account, authentication, and all unrelated product behavior.
- Do not replace real controls with baked interface text or mock interactions.
- Do not add claims, institution data, payment behavior, downloads, or backend authority.
- Do not push, deploy, or execute live database changes without explicit approval.
