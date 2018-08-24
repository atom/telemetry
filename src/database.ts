import * as loki from "lokijs";
import { MultipleCounterError } from "./errors";

interface ICounter {
  name: string;
  count: number;
}

export interface IStatsDatabase {
  close(): void;
  incrementCounter(counterName: string): void;
  clearData(): void;
  getCounters(): Promise<ICounter[]>;
  addCustomEvent(eventType: string, customEvent: any): void;
  addTiming(eventType: string, durationInMilliseconds: number, metadata: object): void;
  getCustomEvents(): Promise<object[]>;
  getTimings(): Promise<object[]>;
}

export default class StatsDatabase implements IStatsDatabase {
  private db: loki;
  /**
   * Counters which can be incremented.
   * Most commonly used for usage stats that don't need
   * additional metadata.
   */
  private counters: Collection<ICounter>;

  /**
   * Events are used to record application metrics that need additional metadata
   * For example, file open events where you'd want to track the language of the file.
   * Events are an object, to give clients maximal flexibility.  Date is automatically added
   * for you in ISO-8601 format.
   */
  private customEvents: Collection<any>;

  /**
   * Timing is used to record application metrics that deal with latency.
   */
  private timings: Collection<any>;

  private getDate: () => string;

  public constructor(getISODate: () => string) {
    this.db = new loki("stats-database", {
      autosave: true,
      autoload: true,
      autosaveInterval: 10000, // 10 seconds
    });
    this.counters = this.db.addCollection("counters");
    this.customEvents = this.db.addCollection("customEvents");
    this.timings = this.db.addCollection("timing");
    this.getDate = () => getISODate();
  }

  public async close() {
    this.db.close();
  }

  public async addCustomEvent(eventType: string, customEvent: any) {
    customEvent.date = this.getDate();
    customEvent.eventType = eventType;
    this.customEvents.insert(customEvent);
  }

  public async incrementCounter(counterName: string) {
    const existing = await this.getUnformattedCounter(counterName);
    if (existing) {
      existing.count += 1;
      this.counters.update(existing);
    } else {
      this.counters.insert({ name: counterName, count: 1 });
    }
  }

  public async addTiming(eventType: string, durationInMilliseconds: number, metadata = {}) {
    const timingData = { eventType, durationInMilliseconds, metadata, date: this.getDate() };
    this.timings.insert(timingData);
  }

  /** Clears all values that exist in the database.
   * returns nothing.
   */
  public async clearData() {
    await this.counters.clear();
    await this.customEvents.clear();
    await this.timings.clear();
  }

  public async getTimings(): Promise<object[]> {
    const timings = await this.timings.find();
    timings.forEach(timing => {
      delete timing.$loki;
      delete timing.meta;
    });
    return timings;
  }

  public async getCustomEvents(): Promise<object[]> {
    const events = await this.customEvents.find();
    events.forEach(event => {
      // honey badger don't care about lokijis meta data.
      delete event.$loki;
      delete event.meta;
    });
    return events;
  }

  /** Get all counters.
   * This method strips the lokijs metadata, which external
   * callers shouldn't care about.
   * Returns something like { commits: 7, coAuthoredCommits: 8 }.
   */
  public async getCounters(): Promise<ICounter[]> {
    const counters: ICounter[] = [];
    this.counters.find().forEach(counter => {
      counters.push({ name: counter.name, count: counter.count });
    });
    return counters;
  }

  /** Get a single counter.
   * Don't strip lokijs metadata, because if we want to update existing
   * items we need to pass that shizz back in.
   * Returns something like:
   * [ { name: 'coAuthoredCommits',count: 1, meta: { revision: 0, created: 1526592157642, version: 0 },'$loki': 1 } ]
   */
  private async getUnformattedCounter(counterName: string): Promise<ICounter | undefined> {
    const existing = await this.counters.find({ name: counterName });

    if (existing.length > 1) {
      // we should never get into this situation because if we are using the lokijs
      // api properly it should overwrite existing items with the same name.
      // but I've seen things (in prod) you people wouldn't believe.
      // Attack ships on fire off the shoulder of Orion.
      // Cosmic rays flipping bits and influencing the outcome of elections.
      // So throw an error just in case.
      throw new MultipleCounterError();
    }

    if (existing.length === 1) {
      return existing[0];
    }

    return undefined;
  }
}
