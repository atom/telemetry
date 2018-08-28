import { assert } from "chai";
import { StatsStore, AppName, StatsGUIDKey } from "../src/index";
import { ISettings } from "telemetry-github";

class MemoryStorage implements ISettings {
  public storage = new Map<string, string>();

  public getItem(key: string): Promise<string | undefined> {
    return Promise.resolve(this.storage.get(key));
  }

  public setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }
}

describe("uuid", () => {
  describe("getGUID", function() {
    it("uses cached GUID if one exists already", async function() {
      const storage = new MemoryStorage();
      let store1 = new StatsStore(AppName.Atom, "1.0", () => "", storage);
      let store2 = new StatsStore(AppName.Atom, "1.0", () => "", storage);
      assert.deepEqual((<any>store1).guid, (<any>store2).guid);
      await store1.shutdown();
      await store2.shutdown();
    });
  });
});
