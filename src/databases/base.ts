export interface IBaseDatabase {
  addCustomEvent(eventType: string, customEvent: any): Promise<unknown>;

  incrementCounter(counterName: string): Promise<unknown>;

  addTiming(
    eventType: string,
    durationInMilliseconds: number,
    metadata: object | undefined,
  ): Promise<unknown>;

  clearData(): Promise<unknown>;

  getTimings(): Promise<object[]>;

  getCustomEvents(): Promise<object[]>;

  getCounters(): Promise<{[name: string]: number}>;
}
