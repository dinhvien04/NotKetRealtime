const { requireRole } = require("../src/middlewares/role.middleware");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

let nextCalled = false;
const next = () => {
  nextCalled = true;
};

const middleware = requireRole("admin", "moderator");

nextCalled = false;
const res403 = createRes();
middleware({ user: { role: "user" } }, res403, next);
assert(res403.statusCode === 403, "User role should be forbidden");
assert(!nextCalled, "next should not be called for user");

nextCalled = false;
const resAdmin = createRes();
middleware({ user: { role: "admin" } }, resAdmin, next);
assert(nextCalled, "Admin should pass role middleware");

nextCalled = false;
const resMod = createRes();
middleware({ user: { role: "moderator" } }, resMod, next);
assert(nextCalled, "Moderator should pass role middleware");

console.log("Đã kiểm tra role middleware.");