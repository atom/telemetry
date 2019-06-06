import {BaseDatabase, Counters, TimingEvent, CustomEvent} from "./base";
import {getISODate} from "../util";
import { openDB, IDBPDatabase } from "idb";

export default class IndexedDBDatabase implements BaseDatabase {
  private dbPromise: Promise<IDBPDatabase<{
    counters: {
      key: string,
      value: {
        name: string,
        value: number,
      },
    },
    customEvents: {
      value: CustomEvent,
    },
    timingEvents: {
      value: TimingEvent,
    },
  }> | void>;

  public constructor() {
    this.dbPromise = openDB("atom-telemetry-store", 1, {
      upgrade(db) {
        db.createObjectStore("counters", { keyPath: "name" });
        db.createObjectStore("customEvents", { autoIncrement : true });
        db.createObjectStore("timingEvents", { autoIncrement : true });
      },
    }).catch(() => {
      console.warn(
        "Could not open IndexedDB database to store telemetry events. This session events won't be recorded."
      );
    });
  }

  public async addCustomEvent(eventType: string, customEvent: object) {
    const db = await this.dbPromise;
    if (!db) {
      return;
    }

    const eventToInsert = {
      ...customEvent,
      date: getISODate(),
      eventType,
    };

    db.put("customEvents", eventToInsert);
  }

  public async incrementCounter(counterName: string) {
    const db = await this.dbPromise;
    if (!db) {
      return;
    }

    const tx = db.transaction("counters", "readwrite");
    const entry = await tx.store.get(counterName);
    const currentValue = entry ? entry.value : 0;

    await tx.store.put({name: counterName, value: currentValue + 1});

    await tx.done;
  }

  public async addTiming(eventType: string, durationInMilliseconds: number, metadata: object = {}) {
    const db = await this.dbPromise;
    if (!db) {
      return;
    }

    const timingData = {
      eventType,
      durationInMilliseconds,
      metadata,
      date: getISODate(),
    };

    db.put("timingEvents", timingData);
  }

  public async clearData() {
    const db = await this.dbPromise;
    if (!db) {
      return;
    }

    const tx = db.transaction(
      ["counters", "customEvents", "timingEvents"],
      "readwrite",
    );

    await tx.objectStore("counters").clear();
    await tx.objectStore("customEvents").clear();
    await tx.objectStore("timingEvents").clear();

    await tx.done;
  }

  public async getTimings(): Promise<TimingEvent[]> {
    const db = await this.dbPromise;
    if (!db) {
      return [];
    }

    return db.getAll("timingEvents");
  }

  public async getCustomEvents(): Promise<CustomEvent[]> {
    const db = await this.dbPromise;
    if (!db) {
      return [];
    }

    return db.getAll("customEvents");
  }

  /**
   * Get all counters.
   * Returns something like { commits: 7, coAuthoredCommits: 8 }.
   */
  public async getCounters(): Promise<Counters> {
    const db = await this.dbPromise;
    if (!db) {
      return {};
    }

    const counters: Counters = Object.create(null);

    const entries = await db.getAll("counters");

    for (const { name, value } of entries) {
      counters[name] = value;
    }

    return counters;
  }
}
