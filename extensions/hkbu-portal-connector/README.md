# ConCourse HKBU Portal Connector

This is an optional, user-operated Chromium Manifest V3 helper. It copies a
privacy-minimised snapshot of **visible academic tables** from supported HKBU
portal pages into a ConCourse tab.

It is not an HKBU login integration, does not prove current enrolment, and does
not make imported data official. ConCourse must label the payload
`user_imported_unverified_snapshot`.

## Install locally

1. Open `chrome://extensions` in Chrome, Edge, Brave, or another Chromium
   browser.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `extensions/hkbu-portal-connector` directory.

## Use

1. Sign in to HKBU directly and open a supported course, enrolment, timetable,
   or graduation-requirement page.
2. Open the extension and click **Scan this HKBU page**.
3. Review the redacted preview. Scan other supported portal pages as needed;
   each deliberate scan merges and deduplicates its academic records in session
   storage. An unfamiliar table structure fails closed and produces no change.
   If the semester is unresolved, scan a page whose visible selected term,
   caption, or heading contains the academic term; sending remains disabled
   until exactly one bounded term such as `Semester 1 2026-27` is recognised.
4. Open ConCourse in another tab, open the extension there, and click
   **Send to this ConCourse tab**.
5. Click **Disconnect & purge** at any time to remove the snapshot from
   `chrome.storage.session`.

The ConCourse page can receive the versioned event:

```js
window.addEventListener("concourse:hkbu-portal-snapshot", (event) => {
  // Validate event.detail.schema_version and source mode before use.
  console.log(event.detail);
});
```

## Security and privacy boundaries

- Code runs on a portal page only after the user clicks **Scan**.
- There is no persistent host permission. A click grants temporary `activeTab`
  access, and code then allows HTTPS on exactly:
  - `buniport.hkbu.edu.hk`
  - `buniport03.hkbu.edu.hk`
  - `iss.hkbu.edu.hk`
- The extension requests only `activeTab`, `scripting`, and `storage`.
- It has no cookie, `webRequest`, credential, password, or background-login
  capability.
- It reads rendered table text, never form values.
- Extraction uses an allowlist of academic headers. Identity, contact,
  instructor, grade, mark, result, and GPA columns are discarded.
- Values resembling email addresses or eight-to-ten-digit student numbers are
  discarded even when they appear in an otherwise allowed column.
- Only safe page-kind strings are retained. Origins, URL paths, query strings,
  page titles, and HTML are not.
- Data is held only in `chrome.storage.session`, not local or synced storage.
- Sending requires a second click on a ConCourse origin explicitly allowlisted
  in `popup.js`; its title and description must also identify it as ConCourse.
  The Pages build permits and packages only `https://concoursehk.com`.
  Delivery uses the `concourse:hkbu-portal-snapshot` `CustomEvent`; no
  ConCourse host permission is requested.
- The helper never automates MFA, replays a university session, registers a
  course, or runs a periodic scrape.

Technical minimisation does not itself grant permission to reuse portal data.
Obtain HKBU approval before distributing the extension.

## Schema v1

The event detail uses:

```text
schema_version: 1
source:
  institution: "hkbu"
  mode: "user_portal_import"
  captured_at, term, parser_version
  pages: safe page-kind strings only
academic_profile:
  programme, major, catalogue_year, degree_level, study_year
assigned_courses:
  course_code, title, units, section, status, meetings
completed_courses:
  course_code, units, result_scope: "completion_only"
remaining_requirements:
  requirement_id, group, units_required, units_remaining,
  allowed_course_codes, portal_text
catalogue_courses:
  course_code, title, units, teaching_medium, prerequisite_text,
  corequisite_text, target_students, sections
```

Each `source.pages` entry is one of exactly `academic_profile`,
`student_enrolment`, `personal_timetable`, `degree_progress`, or
`course_information`. The single snapshot timestamp is `source.captured_at`;
origins, paths, query strings, page titles, and HTML are never retained.

Meetings use numeric weekdays (`1` Monday through `6` Saturday), 24-hour
`HH:MM` start/end values, and an optional venue. The parser recognises separate
Day and Time columns as well as HKBU-style combined Day/Time values such as
`Tue 09:30-11:20 ; Fri 12:30-13:20`. Profile context is limited to programme,
major, study year, curriculum/catalogue year, and degree level.

## Test

From the repository root, use the bundled Node runtime:

```sh
node --test tests/hkbu-browser-helper.test.mjs
```

The test checks the manifest permissions, privacy invariants, parser allowlist,
redaction, supported-origin boundary, unknown-structure failure, payload schema,
multi-page session merging, and user-operated delivery mechanism.
