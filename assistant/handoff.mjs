export const ACTIVE_USER_SESSION_KEY = "concourse_active_user_id_v1";
export const TIMETABLE_HANDOFF_SESSION_KEY =
  "concourse_timetable_selection_handoff_v1";
export const TIMETABLE_HANDOFF_VERSION = 1;
export const TIMETABLE_HANDOFF_LIMIT = 20;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function boundedText(value, limit = 240) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

const DAY_NUMBERS = Object.freeze({
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
});

export function sessionsFromDayTime(value) {
  const source = boundedText(value, 500);
  if (!source || /to be arranged|tba|not (?:yet )?available/i.test(source)) {
    return [];
  }

  const sessions = source.split(/\s*;\s*/).map((part) => {
    const match =
      /^(Mon|Tue|Wed|Thu|Fri|Sat)\s+([01]\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]\d|2[0-3]):([0-5]\d)(?:\s|$)/i.exec(
        part
      );
    if (!match) return null;
    const start = Number(match[2]) * 60 + Number(match[3]);
    const end = Number(match[4]) * 60 + Number(match[5]);
    if (end <= start) return null;
    return {
      days: [DAY_NUMBERS[match[1].toLowerCase()]],
      start,
      end
    };
  });

  return sessions.length && sessions.every(Boolean) ? sessions : [];
}

function numericCredits(value) {
  if (value === null || value === undefined || value === "") return null;
  const credits = Number(value);
  return Number.isFinite(credits) && credits >= 0 && credits <= 99
    ? credits
    : null;
}

export function courseChoicesForGroup(group) {
  return (Array.isArray(group?.entries) ? group.entries : []).flatMap((entry) => {
    const sections = Array.isArray(entry?.sections) && entry.sections.length
      ? entry.sections
      : [""];
    return sections.map((sectionValue) => {
      const section = String(sectionValue ?? "");
      const sectionDetail = (Array.isArray(entry?.sectionDetails)
        ? entry.sectionDetails
        : []
      ).find((candidate) => String(candidate?.section ?? "") === section);
      return {
        id: `${String(entry?.id || "")}::${section}`,
        section,
        entry,
        instructor: boundedText(sectionDetail?.instructor || entry?.instructor),
        dayTime: boundedText(sectionDetail?.dayTime, 500)
      };
    });
  });
}

export function resolveCourseKeySelection(groups, value) {
  const courseKey = boundedText(value, 500);
  if (!courseKey) return null;

  const candidates = Array.isArray(groups) ? groups : [];
  for (const group of candidates) {
    const choices = courseChoicesForGroup(group);
    const choice = choices.find((candidate) => candidate.id === courseKey);
    if (choice) return { group, choiceId: choice.id };
  }

  for (const group of candidates) {
    const entry = (Array.isArray(group?.entries) ? group.entries : []).find(
      (candidate) => String(candidate?.id || "") === courseKey
    );
    if (entry) {
      const choice = courseChoicesForGroup({
        entries: [entry]
      })[0];
      return choice ? { group, choiceId: choice.id } : null;
    }
  }

  for (const group of candidates) {
    if (String(group?.id || "") === courseKey) {
      const choice = courseChoicesForGroup(group)[0];
      return choice ? { group, choiceId: choice.id } : null;
    }
  }

  for (const group of candidates) {
    const entry = (Array.isArray(group?.entries) ? group.entries : []).find(
      (candidate) => String(candidate?.sourceCourseId || "") === courseKey
    );
    if (entry) {
      const choice = courseChoicesForGroup({
        entries: [entry]
      })[0];
      return choice ? { group, choiceId: choice.id } : null;
    }
  }

  return null;
}

function selectionEntries(selections) {
  if (selections instanceof Map) return [...selections];
  if (!Array.isArray(selections)) return [];
  return selections.map((selection) => [
    selection?.groupId,
    selection?.choiceId
  ]);
}

export function resolveSelectedChoices(groups, selections) {
  const groupsById = new Map(
    (Array.isArray(groups) ? groups : []).map((group) => [
      String(group?.id || ""),
      group
    ])
  );
  const resolved = [];
  const seenGroups = new Set();

  for (const [groupIdValue, choiceIdValue] of selectionEntries(selections)) {
    if (resolved.length >= TIMETABLE_HANDOFF_LIMIT) break;
    const groupId = String(groupIdValue || "");
    const choiceId = String(choiceIdValue || "");
    if (!groupId || !choiceId || seenGroups.has(groupId)) continue;

    const group = groupsById.get(groupId);
    const choice = courseChoicesForGroup(group).find(
      (candidate) => candidate.id === choiceId
    );
    if (!group || !choice) continue;

    const entry = choice.entry || {};
    resolved.push({
      groupId: boundedText(group.id, 500),
      choiceId: boundedText(choice.id, 500),
      courseKey: boundedText(entry.id, 300),
      institutionId: boundedText(group.institutionId, 120),
      institutionName: boundedText(group.institutionName, 240),
      institutionShortName: boundedText(group.institutionShortName, 80),
      courseTitle: boundedText(group.title, 300),
      courseCode: boundedText(group.code, 80),
      faculty: boundedText(group.faculty, 240),
      academicPeriod: boundedText(group.academicPeriod, 160),
      sourceCourseId: boundedText(entry.sourceCourseId, 160),
      section: boundedText(choice.section, 120),
      instructor: boundedText(choice.instructor || entry.instructor, 240),
      credits: numericCredits(group.units),
      sessions: sessionsFromDayTime(choice.dayTime)
    });
    seenGroups.add(groupId);
  }

  return resolved;
}

export function readActiveUserId(storage) {
  try {
    const userId = boundedText(storage?.getItem(ACTIVE_USER_SESSION_KEY), 80);
    return UUID_PATTERN.test(userId) ? userId.toLowerCase() : "";
  } catch (_error) {
    return "";
  }
}

function fallbackHandoffId() {
  const random = Math.random().toString(36).slice(2, 14);
  return `selection-${Date.now().toString(36)}-${random}`;
}

export function createTimetableHandoff({
  userId,
  selections,
  createdAt = new Date(),
  handoffId
}) {
  const safeUserId = boundedText(userId, 80).toLowerCase();
  if (!UUID_PATTERN.test(safeUserId)) {
    throw new TypeError("A valid active user id is required");
  }

  const safeSelections = (Array.isArray(selections) ? selections : [])
    .slice(0, TIMETABLE_HANDOFF_LIMIT)
    .map((selection) => ({
      groupId: boundedText(selection?.groupId, 500),
      choiceId: boundedText(selection?.choiceId, 500),
      courseKey: boundedText(selection?.courseKey, 300),
      institutionId: boundedText(selection?.institutionId, 120),
      institutionName: boundedText(selection?.institutionName, 240),
      institutionShortName: boundedText(selection?.institutionShortName, 80),
      courseTitle: boundedText(selection?.courseTitle, 300),
      courseCode: boundedText(selection?.courseCode, 80),
      faculty: boundedText(selection?.faculty, 240),
      academicPeriod: boundedText(selection?.academicPeriod, 160),
      sourceCourseId: boundedText(selection?.sourceCourseId, 160),
      section: boundedText(selection?.section, 120),
      instructor: boundedText(selection?.instructor, 240),
      credits: numericCredits(selection?.credits),
      sessions: (Array.isArray(selection?.sessions) ? selection.sessions : [])
        .slice(0, 6)
        .map((session) => ({
          days: [...new Set((Array.isArray(session?.days) ? session.days : [])
            .map(Number)
            .filter((day) => Number.isInteger(day) && day >= 1 && day <= 6))]
            .sort((left, right) => left - right),
          start: Number(session?.start),
          end: Number(session?.end)
        }))
        .filter((session) =>
          session.days.length &&
          Number.isInteger(session.start) &&
          Number.isInteger(session.end) &&
          session.start >= 0 &&
          session.end <= 1440 &&
          session.end > session.start
        )
    }))
    .filter((selection) =>
      selection.groupId &&
      selection.choiceId &&
      selection.courseTitle
    );
  if (!safeSelections.length) {
    throw new TypeError("At least one resolved course selection is required");
  }

  const timestamp = createdAt instanceof Date
    ? createdAt
    : new Date(createdAt);
  if (Number.isNaN(timestamp.valueOf())) {
    throw new TypeError("A valid handoff timestamp is required");
  }

  const generatedId =
    globalThis.crypto?.randomUUID?.() || fallbackHandoffId();
  return {
    version: TIMETABLE_HANDOFF_VERSION,
    kind: "course-selection",
    handoffId: boundedText(handoffId || generatedId, 120),
    createdAt: timestamp.toISOString(),
    userId: safeUserId,
    selections: safeSelections
  };
}
