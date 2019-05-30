export interface BaseDatabase {
  addCustomEvent(eventType: string, customEvent: object): Promise<unknown>;

  incrementCounter(counterName: string): Promise<unknown>;

  addTiming(
    eventType: string,
    durationInMilliseconds: number,
    metadata?: object,
  ): Promise<unknown>;

  clearData(): Promise<unknown>;

  getTimings(): Promise<TimingEvent[]>;

  getCustomEvents(): Promise<CustomEvent[]>;

  getCounters(): Promise<Counters>;
}

export interface Counters {
  [name: string]: number;
}

export interface TimingEvent {
  date: string;
  eventType: string;
  durationInMilliseconds: number;
  metadata: object;
}

export interface CustomEvent {
  date: string;
  eventType: string;
}
