export interface IBaseDatabase {
  addCustomEvent(eventType: string, customEvent: object): Promise<unknown>;

  incrementCounter(counterName: string): Promise<unknown>;

  addTiming(
    eventType: string,
    durationInMilliseconds: number,
    metadata: object | undefined,
  ): Promise<unknown>;

  clearData(): Promise<unknown>;

  getTimings(): Promise<ITimingEvent[]>;

  getCustomEvents(): Promise<ICustomEvent[]>;

  getCounters(): Promise<ICounters>;
}

export interface ICounters {
  [name: string]: number;
}

export interface ITimingEvent {
  date: string;
  eventType: string;
  durationInMilliseconds: number;
  metadata: object;
}

export interface ICustomEvent {
  date: string;
  eventType: string;
}
