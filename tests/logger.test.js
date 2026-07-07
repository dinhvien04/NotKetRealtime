const assert = require("assert");
const logger = require("../src/utils/logger");

let output = "";
const originalLog = console.log;
console.log = (...args) => {
  output += `${args.join(" ")} `;
};

try {
  logger.info("health-check");
  assert.ok(output.includes("health-check"));
  console.log = originalLog;
  console.log("Đã kiểm tra logger info output.");
} catch (error) {
  console.log = originalLog;
  throw error;
}