const users = new Map();

function normalizeName(username) {
  return username.trim().replace(/\s+/g, " ");
}

function createUniqueName(username) {
  const baseName = normalizeName(username);
  const existingNames = new Set(
    Array.from(users.values(), (user) => user.username.toLocaleLowerCase("vi"))
  );

  if (!existingNames.has(baseName.toLocaleLowerCase("vi"))) {
    return baseName;
  }

  let suffix = 2;
  while (existingNames.has(`${baseName} ${suffix}`.toLocaleLowerCase("vi"))) {
    suffix += 1;
  }

  return `${baseName} ${suffix}`;
}

function addUser(socketId, username, userId = socketId) {
  const existingUser = findUserById(userId);
  if (existingUser) {
    users.delete(existingUser.socketId);
  }

  const user = {
    id: userId,
    socketId,
    username: existingUser?.username || createUniqueName(username)
  };

  users.set(socketId, user);
  return { ...user };
}

function removeUser(socketId) {
  const user = users.get(socketId);
  users.delete(socketId);
  return user ? { ...user } : null;
}

function getUser(socketId) {
  const user = users.get(socketId);
  return user ? { ...user } : null;
}

function getAllUsers() {
  return Array.from(users.values(), (user) => ({ ...user }));
}

function findUserBySocketId(socketId) {
  return getUser(socketId);
}

function findUserById(userId) {
  const user = Array.from(users.values()).find((item) => item.id === userId);
  return user ? { ...user } : null;
}

function isUserOnline(identifier) {
  return users.has(identifier) || Boolean(findUserById(identifier));
}

module.exports = {
  addUser,
  removeUser,
  getUser,
  getAllUsers,
  findUserBySocketId,
  findUserById,
  isUserOnline
};
