import { randomBytes } from "crypto";
const uuidv4 = require("uuid/v4");

/**
 * Wrapper function over uuid's v4 method that attempts to source
 * entropy using Node's randomBytes
 */
function uuid(): string {
  return uuidv4({random: randomBytes(16)});
}

/** The localStorage key for the stats GUID. */
export const StatsGUIDKey = "stats-guid";

let cachedGUID: string | null = null;

/** Get the stats GUID. */
export function getGUID(): string {
  if (!cachedGUID) {
    let GUID = localStorage.getItem(StatsGUIDKey);
    if (!GUID) {
      GUID = uuid();
      localStorage.setItem(StatsGUIDKey, GUID);
    }

    cachedGUID = GUID;
  }
  return cachedGUID;
}
