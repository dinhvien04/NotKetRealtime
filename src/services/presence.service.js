const memoryPresence = require("../models/presence.model");
const redisService = require("./redis.service");
const config = require("../config/env");

const PRESENCE_KEY_PREFIX = "presence:user:";
const PRESENCE_SOCKET_PREFIX = "presence:socket:";
const PRESENCE_ONLINE_SET = "presence:online";

function buildPresence(user, socketId) {
  return {
    id: user.id,
    socketId,
    username: user.username,
    displayName: user.displayName || user.username
  };
}

async function addRedisPresence(socketId, user) {
  const client = redisService.getClient();
  const presence = buildPresence(user, socketId);
  const payload = JSON.stringify(presence);

  const previousSocket = await client.get(`${PRESENCE_KEY_PREFIX}${user.id}`);
  if (previousSocket && previousSocket !== socketId) {
    await client.del(`${PRESENCE_SOCKET_PREFIX}${previousSocket}`);
  }

  await client
    .multi()
    .set(`${PRESENCE_KEY_PREFIX}${user.id}`, socketId, { EX: config.presenceTtlSeconds })
    .set(`${PRESENCE_SOCKET_PREFIX}${socketId}`, payload, { EX: config.presenceTtlSeconds })
    .sAdd(PRESENCE_ONLINE_SET, user.id)
    .exec();

  return { ...presence };
}

async function removeRedisPresence(socketId) {
  const client = redisService.getClient();
  const raw = await client.get(`${PRESENCE_SOCKET_PREFIX}${socketId}`);
  if (!raw) return null;

  await client.del(`${PRESENCE_SOCKET_PREFIX}${socketId}`);
  let presence = null;
  try {
    presence = JSON.parse(raw);
  } catch (_error) {
    return null;
  }

  const currentSocket = await client.get(`${PRESENCE_KEY_PREFIX}${presence.id}`);
  if (currentSocket === socketId) {
    await client
      .multi()
      .del(`${PRESENCE_KEY_PREFIX}${presence.id}`)
      .sRem(PRESENCE_ONLINE_SET, presence.id)
      .exec();
  }

  return { ...presence };
}

async function getAllRedisOnline() {
  const client = redisService.getClient();
  const userIds = await client.sMembers(PRESENCE_ONLINE_SET);
  if (!userIds.length) return [];

  const users = [];
  const staleUserIds = [];

  for (const userId of userIds) {
    const socketId = await client.get(`${PRESENCE_KEY_PREFIX}${userId}`);
    if (!socketId) {
      staleUserIds.push(userId);
      continue;
    }
    const raw = await client.get(`${PRESENCE_SOCKET_PREFIX}${socketId}`);
    if (!raw) {
      staleUserIds.push(userId);
      continue;
    }
    try {
      users.push(JSON.parse(raw));
    } catch (_error) {
      staleUserIds.push(userId);
    }
  }

  if (staleUserIds.length) {
    await client.sRem(PRESENCE_ONLINE_SET, staleUserIds);
  }

  return users;
}

async function isRedisOnline(userId) {
  const client = redisService.getClient();
  const socketId = await client.get(`${PRESENCE_KEY_PREFIX}${userId}`);
  return Boolean(socketId);
}

async function addPresence(socketId, user) {
  if (redisService.isEnabled()) {
    return addRedisPresence(socketId, user);
  }
  return memoryPresence.addPresence(socketId, user);
}

async function removePresence(socketId) {
  if (redisService.isEnabled()) {
    return removeRedisPresence(socketId);
  }
  return memoryPresence.removePresence(socketId);
}

async function getAllOnline() {
  if (redisService.isEnabled()) {
    return getAllRedisOnline();
  }
  return memoryPresence.getAllOnline();
}

async function isOnline(userId) {
  if (redisService.isEnabled()) {
    return isRedisOnline(userId);
  }
  return memoryPresence.isOnline(userId);
}

function getPresenceBySocket(socketId) {
  return memoryPresence.getPresenceBySocket(socketId);
}

function getPresenceByUserId(userId) {
  return memoryPresence.getPresenceByUserId(userId);
}

module.exports = {
  addPresence,
  removePresence,
  getAllOnline,
  isOnline,
  getPresenceBySocket,
  getPresenceByUserId
};