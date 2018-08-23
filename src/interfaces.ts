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