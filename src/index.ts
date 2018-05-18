require("isomorphic-fetch");

import { getGUID } from "./uuid";
import MeasuresDatabase from "./database";

// const baseUsageApi = 'https://central.github.com/api/usage/';

const baseUsageApi = "http://localhost:4000/api/usage/";

const LastDailyStatsReportKey = "last-daily-stats-report";

/** Class that wraps db where metrics are stored so they can persist across sessions. */
const measuresDb = new MeasuresDatabase();

/** The localStorage key for whether the user has opted out. */
export const StatsOptOutKey = "stats-opt-out";

/** Have we successfully sent the stats opt-in? */
export const HasSentOptInPingKey = "has-sent-stats-opt-in-ping";

/** The localStorage key where feature usage data is tracked. */
const StatsMeasuresKey = "stats-measures";

/** How often daily stats should be submitted (i.e., 24 hours). */
const DailyStatsReportInterval = 1000 * 60 * 60 * 24;

interface IDimensions {
  /** The app version. */
  readonly version: string;

  /** the platform */
  readonly platform: string;

  /** The install ID. */
  readonly guid: string;

  /** The date the metrics were sent, in ISO-8601 format */
  readonly date: string;

  /** GitHub api access token, if the user is authenticated */
  readonly accessToken: string | null;

  readonly eventType: "usage";

  readonly language: string | null;
}

interface IMetrics {
  dimensions: IDimensions;
  // metrics names are defined by the client and thus aren't knowable
  // at compile time here.
  measures: object;
}

/** The goal is for this package to be app-agnostic so we can add
 * other editors in the future.
 */
export enum AppName {
  Atom = "atom",
}

/** helper for getting the date, which we pass in so that we can mock
 * in unit tests.
 */
const getISODate = () => new Date(Date.now()).toISOString();

export class StatsStore {

  /** Has the user opted out of stats reporting? */
  private optOut: boolean;

  /** api for calling central with our stats */
  private appUrl: string;

  /** which version are we running, dawg */
  private version: string;

  public constructor(appName: AppName, version: string) {
    this.version = version;
    this.appUrl = baseUsageApi + appName;
    const optOutValue = localStorage.getItem(StatsOptOutKey);

    if (optOutValue) {
      this.optOut = !!parseInt(optOutValue, 10);

      // If the user has set an opt out value but we haven't sent the ping yet,
      // give it a shot now.
      if (!localStorage.getItem(HasSentOptInPingKey)) {
        this.sendOptInStatusPing(!this.optOut);
      }
    } else {
      this.optOut = false;
    }
  }

  /** Set whether the user has opted out of stats reporting. */
  public async setOptOut(optOut: boolean): Promise<void> {
    const changed = this.optOut !== optOut;

    this.optOut = optOut;

    localStorage.setItem(StatsOptOutKey, optOut ? "1" : "0");
    console.log("CHANGED", changed);
    if (changed) {
      await this.sendOptInStatusPing(!optOut);
    }
  }

  public async reportStats(getDate: () => string) {
    if (this.optOut) {
      return;
    }
    const stats = await this.getDailyStats(getDate);

    try {
      const response = await this.post(stats);
      if (response.status !== 200) {
        throw new Error(`Stats reporting failure: ${response.status})`);
      } else {
        measuresDb.clearMeasures();
        console.log("stats successfully reported");
      }
    } catch (err) {
      // todo (tt, 5/2018): would be good to log these errors to Haystack/Datadog
      // so we have some kind of visibility into how often things are failing.
      console.log(err);
    }
  }

  /* send a ping to indicate that the user has changed their opt-in preferences.
  * public for testing purposes only.
  */
  public async sendOptInStatusPing(optIn: boolean): Promise<void> {
    const direction = optIn ? "in" : "out";
    try {
      const response = await this.post({
        eventType: "ping",
        optIn,
      });
      if (response.status !== 200) {
        throw new Error(`Error sending opt in ping: ${response.status}`);
      }
      localStorage.setItem(HasSentOptInPingKey, "1");

      console.log(`Opt ${direction} reported.`);
    } catch (err) {
      // todo (tt, 5/2018): would be good to log these errors to Haystack/Datadog
      // so we have some kind of visibility into how often things are failing.
      console.log(`Error reporting opt ${direction}`, err);
    }
  }

  // public for testing purposes only
  // todo(tt, 5/2018): is there a way of making things "package private" in typescript?
  // or an annotation that communicates "public for testing only"?
  public async getDailyStats(getDate: () => string): Promise<IMetrics> {
    return {
      measures: await measuresDb.getMeasures(),
      dimensions: {
      version: this.version,
      platform: process.platform,
      guid: getGUID(),
      accessToken: null,
      eventType: "usage",
      date: getDate(),
      language: null,
      },
    };
  }

  public async incrementMeasure(measureName: string) {
    await measuresDb.incrementMeasure(measureName);
  }

  /** Post some data to our stats endpoint.
   * This is public for testing purposes only.
   */
  public async post(body: object): Promise<Response> {
    const options: object = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
  };

    return fetch(this.appUrl, options);
  }

  /** Should the app report its daily stats? */
  private shouldReportDailyStats(): boolean {
    const lastDateString = localStorage.getItem(LastDailyStatsReportKey);
    let lastDate = 0;
    if (lastDateString && lastDateString.length > 0) {
      lastDate = parseInt(lastDateString, 10);
    }

    if (isNaN(lastDate)) {
      lastDate = 0;
    }

    const now = Date.now();
    return now - lastDate > DailyStatsReportInterval;
  }
}
