# ConCourse Timetable Rebuild

This is an isolated Timetable-only validation build for the Beta channel. It does not change Supabase schema or production data.

## Visible scope

- FAN-T111 live weekly timetable
- native wheel and trackpad driven 3D traversal
- course identity, credits, required status, and wishlist
- one to six weekly meetings and alternate meeting bundles
- degree level and study year
- minimum and maximum credits
- fewest or exact course count
- preferred and specific free weekdays
- compactness, fewer campus days, early and late thresholds
- free-time blocks
- bounded conflict-free solver with six ranked results
- final timetable save and print path

Course Search, Student Hub, Campus Community, Campus Market, Messages, Academic Tools, and Academic Insights intentionally have no visible entry in this phase.

## Compatibility boundary

The rebuild preserves planner state version 2 with `courses`, `breaks`, `selectedFreeDays`, `academic`, `semester`, `preferences`, and `finalTimetable`. Course `options` remain complete bundles of `sessions`, including imported multi-day sessions and optional section, choice, source, and venue metadata.

Account state still reads and writes `user_state`, mirrors degree and year to `profiles`, and keeps the existing account-bound selection handoff keys. Only the public Supabase publishable key may be used in browser code.

## Local validation

Serve this worktree on port 4175 and open `http://127.0.0.1:4175/`. Approved validation builds publish through the repository's `beta` branch to `https://beta.concoursehk.com`; the production `main` deployment remains isolated.
