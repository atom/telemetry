import { assert } from "chai";
import { StatsStore, AppName, StatsGUIDKey } from "../src/index";
import { IStorage } from "../src/interfaces";

class MemoryStorage implements IStorage {
  public storage = new Map<string, string>();

  getItem(key: string): string | undefined {
    return this.storage.get(key);
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }
}

// describe("uuid", () => {
//   describe("getGUID", function() {
//     it("uses cached GUID if one exists already", function() {
//       const storage = new MemoryStorage();
//       let store = new StatsStore(AppName.Atom, "1.0", false, () => "", storage);
//       const GUID = storage.getItem(StatsGUIDKey);
//       store = new StatsStore(AppName.Atom, "1.0", false, () => "", storage);
//       const GUID2 = storage.getItem(StatsGUIDKey);
//       assert.deepEqual(GUID, GUID2);
//     });
//   });
// });
