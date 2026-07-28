import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase-realtime-messaging-fix.sql", import.meta.url),
  "utf8"
);

test("Realtime messaging remains participant-only and anonymous access stays revoked", () => {
  assert.match(
    migration,
    /revoke all on table public\.direct_conversations from public, anon, authenticated/
  );
  assert.match(
    migration,
    /revoke all on table public\.direct_messages from public, anon, authenticated/
  );
  assert.match(
    migration,
    /grant select on table public\.direct_conversations to authenticated/
  );
  assert.match(
    migration,
    /grant select on table public\.direct_messages to authenticated/
  );
  assert.match(
    migration,
    /private\.can_read_direct_conversation\(\s*p_conversation_id,\s*\(select auth\.uid\(\)\)\s*\)/
  );
  assert.match(
    migration,
    /create policy "Messaging participants can read conversations"[\s\S]*?public\.can_realtime_read_direct_conversation\(id\)/
  );
  assert.match(
    migration,
    /create policy "Messaging participants can read messages"[\s\S]*?public\.can_realtime_read_direct_conversation\(conversation_id\)/
  );
});

test("Realtime publication membership is activated idempotently", () => {
  assert.match(migration, /publication\.pubname = 'supabase_realtime'/);
  assert.match(
    migration,
    /alter publication supabase_realtime add table public\.direct_conversations/
  );
  assert.match(
    migration,
    /alter publication supabase_realtime add table public\.direct_messages/
  );
  assert.match(migration, /not exists \([\s\S]*?pg_catalog\.pg_publication_tables/);
  assert.match(migration, /publication\.puballtables/);
});
