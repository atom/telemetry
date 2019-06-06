import {BaseDatabase, Counters, TimingEvent, CustomEvent} from "./base";
import {getISODate} from "../util";

export default class MemoryDatabase implements BaseDatabase {
  private counters: Counters;
  private customEvents: CustomEvent[];
  private timingEvents: TimingEvent[];

  public constructor() {
    this.counters = Object.create(null);
    this.customEvents = [];
    this.timingEvents = [];
  }

  public async addCustomEvent(eventType: string, customEvent: object) {
    const eventToInsert = {
      ...customEvent,
      date: getISODate(),
      eventType,
    };

    this.customEvents.push(eventToInsert);
  }

  public async incrementCounter(counterName: string) {
    this.counters[counterName] = (this.counters[counterName] || 0) + 1;
  }

  public async addTiming(eventType: string, durationInMilliseconds: number, metadata: object = {}) {
    const timingData = {
      eventType,
      durationInMilliseconds,
      metadata,
      date: getISODate(),
    };

    this.timingEvents.push(timingData);
  }

  public async clearData() {
    this.counters = Object.create(null);
    this.customEvents = [];
    this.timingEvents = [];
  }

  public async getTimings(): Promise<TimingEvent[]> {
    return this.timingEvents;
  }

  public async getCustomEvents(): Promise<CustomEvent[]> {
    return this.customEvents;
  }

  /**
   * Get all counters.
   * Returns something like { commits: 7, coAuthoredCommits: 8 }.
   */
  public async getCounters(): Promise<Counters> {
    return this.counters;
  }
}
