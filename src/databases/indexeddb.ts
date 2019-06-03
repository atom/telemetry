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
  }>>;

  public constructor() {
    this.dbPromise = openDB("atom-telemetry-store", 1, {
      upgrade(db) {
        db.createObjectStore("counters", { keyPath: "name" });
        db.createObjectStore("customEvents", { autoIncrement : true });
        db.createObjectStore("timingEvents", { autoIncrement : true });
      },
    });
  }

  public async addCustomEvent(eventType: string, customEvent: object) {
    const eventToInsert = {
      ...customEvent,
      date: getISODate(),
      eventType,
    };

    (await this.dbPromise).put("customEvents", eventToInsert);
  }

  public async incrementCounter(counterName: string) {
    const tx = (await this.dbPromise).transaction("counters", "readwrite");
    const entry = await tx.store.get(counterName);
    const currentValue = entry ? entry.value : 0;

    await tx.store.put({name: counterName, value: currentValue + 1});

    await tx.done;
  }

  public async addTiming(eventType: string, durationInMilliseconds: number, metadata: object = {}) {
    const timingData = {
      eventType,
      durationInMilliseconds,
      metadata,
      date: getISODate(),
    };

    (await this.dbPromise).put("timingEvents", timingData);
  }

  public async clearData() {
    const tx = (await this.dbPromise).transaction(
      ["counters", "customEvents", "timingEvents"],
      "readwrite",
    );

    await tx.objectStore("counters").clear();
    await tx.objectStore("customEvents").clear();
    await tx.objectStore("timingEvents").clear();

    await tx.done;
  }

  public async getTimings(): Promise<TimingEvent[]> {
    return (await this.dbPromise).getAll("timingEvents");
  }

  public async getCustomEvents(): Promise<CustomEvent[]> {
    return (await this.dbPromise).getAll("customEvents");
  }

  /**
   * Get all counters.
   * Returns something like { commits: 7, coAuthoredCommits: 8 }.
   */
  public async getCounters(): Promise<Counters> {
    const counters: Counters = Object.create(null);

    const entries = await (await this.dbPromise).getAll("counters");

    for (const { name, value } of entries) {
      counters[name] = value;
    }

    return counters;
  }
}
