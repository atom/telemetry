import { randomBytes } from "crypto";
const uuidv4 = require("uuid/v4");

/**
 * Wrapper function over uuid's v4 method that attempts to source
 * entropy using Node's randomBytes
 */
export function uuid(): string {
  return uuidv4({ random: randomBytes(16) });
}
