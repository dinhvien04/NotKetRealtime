process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-key-32chars-minimum!";

const assert = require("assert");
const conversationRepository = require("../src/repositories/conversation.repository");
const userRepository = require("../src/repositories/user.repository");
const { getDatabaseError, closePool, query } = require("../src/db");
const argon2 = require("argon2");

async function createTestUser(username) {
  const passwordHash = await argon2.hash("secret12345", {
    type: argon2.argon2id
  });
  return userRepository.createUser({
    username,
    email: `${username}@test.local`,
    passwordHash,
    displayName: username
  });
}

async function run() {
  if (getDatabaseError()) {
    console.log("Bỏ qua direct conversation test vì thiếu DATABASE_URL.");
    return;
  }

  const stamp = Date.now();
  const userA = await createTestUser(`direct_a_${stamp}`);
  const userB = await createTestUser(`direct_b_${stamp}`);

  const attempts = 20;
  const results = await Promise.all(
    Array.from({ length: attempts }, () =>
      conversationRepository.findOrCreateDirectConversation(userA.id, userB.id)
    )
  );

  const uniqueIds = new Set(results);
  assert.equal(uniqueIds.size, 1, "Concurrent create phải trả cùng conversationId");

  const mapping = await query(
    `SELECT conversation_id FROM direct_conversations
     WHERE (user_low = $1 AND user_high = $2)
        OR (user_low = $2 AND user_high = $1)`,
    [userA.id, userB.id]
  );
  assert.equal(mapping.rowCount, 1, "direct_conversations chỉ có một row");

  const participants = await query(
    `SELECT user_id FROM conversation_participants
     WHERE conversation_id = $1 ORDER BY user_id`,
    [results[0]]
  );
  assert.equal(participants.rowCount, 2);
  const participantIds = participants.rows.map((row) => row.user_id).sort();
  assert.deepEqual(participantIds, [userA.id, userB.id].sort());

  const orphans = await conversationRepository.findOrphanDirectConversations();
  assert.equal(orphans.length, 0, "Không được có orphan direct conversation");

  await closePool();
  console.log("Đã kiểm tra direct conversation race và orphan guard.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});