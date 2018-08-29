declare module "telemetry-github" {

  export interface IAppConfiguration {
    reportIntervalInMs: number;
    initialReportDelayInMs: number;
  }

  export interface ISettings {
    getItem(key: string): Promise<string | undefined>;
    setItem(key: string, value: string): Promise<void>;
  }

  export interface IDimensions {
    /** The app version. */
    readonly appVersion: string;

    /** the platform */
    readonly platform: string;

    /** The install ID. */
    readonly guid: string;

    /** The date the metrics were sent, in ISO-8601 format */
    readonly date: string;

    readonly eventType: "usage";

    readonly language: string;

    readonly gitHubUser: string | undefined;
  }

  export interface IMetrics {
    dimensions: IDimensions;
    // metrics names are defined by the client and thus aren't knowable
    // at compile time here.
    measures: object;

    // array of custom events that can be defined by the client
    customEvents: object[];

    // array of timing events
    timings: object[];
  }

  export interface ICounter {
    name: string;
    count: number;
  }

  export interface IStatsDatabase {
    close(): Promise<void>;
    incrementCounter(counterName: string): Promise<void>;
    clearData(): Promise<void>;
    getCounters(): Promise<ICounter[]>;
    addCustomEvent(eventType: string, customEvent: any): Promise<void>;
    addTiming(eventType: string, durationInMilliseconds: number, metadata: object): Promise<void>;
    getCustomEvents(): Promise<object[]>;
    getTimings(): Promise<object[]>;
  }

  export const enum AppName {
    Atom = "atom",
    VSCode = "vscode",
  }

  export class StatsStore {
    constructor(
      appName: AppName,
      version: string,
      getAccessToken?: () => string,
      settings?: ISettings,
      database?: IStatsDatabase,
      configuration?: IAppConfiguration
    );

    /** Set the username to send along with the metrics (optional) */
    setGitHubUser(gitHubUser: string): void;

    /** Are we running in development mode? */
    setDevMode(isDevMode: boolean): void;

    /** Disable storing metrics when in development mode.
     * The default is false because the default backend is localStorage,
     * which cannot distinguish between dev and non-dev mode when saving
     * metrics. If you supply a backend that can store dev and release metrics
     * in different places, set this to true
     */
    setTrackInDevMode(track: boolean): void;

    /** Shutdown the data store, if the backend supports it */
    shutdown() : Promise<void>;
    /** Set whether the user has opted out of stats reporting. */
    setOptOut(optOut: boolean): Promise<void>;
    reportStats(getDate: () => string): Promise<void>;

    addCustomEvent(eventType: string, event: object): Promise<void>;
    /**
     * Add timing data to the stats store, to be sent with the daily metrics requests.
     */
    addTiming(eventType: string, durationInMilliseconds: number, metadata?: {}): Promise<void>;
    /**
     * Increment a counter.  This is used to track usage statistics.
     */
    incrementCounter(counterName: string): Promise<void>;
  }
}
