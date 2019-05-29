import { getGUID } from "./uuid";
import {IBaseDatabase, ITimingEvent, ICustomEvent, ICounters} from "./databases/base";
import StatsDatabase from "./databases/loki";
import {getISODate} from "./util";

// if you're running a local instance of central, use
// "http://localhost:4000/api/usage/" instead.
const baseUsageApi = "https://central.github.com/api/usage/";

export const LastDailyStatsReportKey = "last-daily-stats-report";

/** The localStorage key for whether the user has opted out. */
export const StatsOptOutKey = "stats-opt-out";

/** Have we successfully sent the stats opt-in? */
export const HasSentOptInPingKey = "has-sent-stats-opt-in-ping";

/** milliseconds in an hour (for readability, dawg) */
const hours = 60 * 60 * 1000;

/** How often daily stats should be submitted (i.e., 24 hours). */
export const DailyStatsReportIntervalInMs = hours * 24;

interface IDimensions {
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

  readonly gitHubUser: string | null;
}

export interface IMetrics {
  dimensions: IDimensions;
  // object with the value for each counter name.
  measures: ICounters;

  // array of custom events that can be defined by the client
  customEvents: ICustomEvent[];

  // array of timing events
  timings: ITimingEvent[];
}

/** The goal is for this package to be app-agnostic so we can add
 * other editors in the future.
 */
export enum AppName {
  Atom = "atom",
}

export class StatsStore {

  private timer: NodeJS.Timer;

  /** Has the user opted out of stats reporting? */
  private optOut: boolean;

  /** api for calling central with our stats */
  private appUrl: string;

  /** which version are we running, dawg */
  private version: string;

  /** is electron app running in development mode?
   * There isn't currently a consistent way of programmatically determining if an app
   * is in dev mode that works in Desktop, Atom, and vscode.
   * Todo: use Electron's new api to determine whether we are in dev mode, once
   * all the clients using `telemetry` are on. Electron versions that support this api.
   * https://github.com/electron/electron/issues/7714
   */
  private isDevMode: boolean;

  /** Instance of a class thats stores metrics so they can be stored across sessions */
  private database: IBaseDatabase;

  /** function for getting GitHub access token if one exists.
   * We don't want to store the token, due to security concerns, and also
   * because the token might expire.
   */
  private getAccessToken: () => string;

  private gitHubUser: string | null;

  /** How often daily stats should be submitted (in ms). */
  private reportingFrequency: number;

  /** If true, it'll print every metrics request on the console. */
  private verboseMode: boolean;

  public constructor(
    appName: AppName,
    version: string,
    isDevMode: boolean,
    getAccessToken = () => "",
    options: {
      logInDevMode?: boolean,
      reportingFrequency?: number,
      verboseMode?: boolean,
    } = {},
  ) {
    this.database = new StatsDatabase();
    this.version = version;
    this.appUrl = baseUsageApi + appName;
    const optOutValue = localStorage.getItem(StatsOptOutKey);

    this.isDevMode = !options.logInDevMode && isDevMode;
    this.getAccessToken = getAccessToken;
    this.gitHubUser = null;

    this.reportingFrequency = options.reportingFrequency || exports.DailyStatsReportIntervalInMs;

    // We set verbose mode when logging in Dev mode to prevent users from forgetting to turn
    // off the logging in dev mode.
    this.verboseMode = (!!options.logInDevMode && isDevMode) || !!options.verboseMode;
    this.timer = this.getTimer(this.reportingFrequency / 6);

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

  public setGitHubUser(gitHubUser: string) {
    this.gitHubUser = gitHubUser;
  }

  /** Set whether the user has opted out of stats reporting. */
  public async setOptOut(optOut: boolean): Promise<void> {
    const changed = this.optOut !== optOut;

    this.optOut = optOut;

    localStorage.setItem(StatsOptOutKey, optOut ? "1" : "0");

    if (changed) {
      await this.sendOptInStatusPing(!optOut);
    }
  }

  public async reportStats() {
    if (this.optOut || this.isDevMode) {
      return;
    }
    const stats = await this.getDailyStats();

    try {
      const response = await this.post(stats);
      if (response.status !== 200) {
        throw new Error(`Stats reporting failure: ${response.status})`);
      } else {
        await localStorage.setItem(LastDailyStatsReportKey, Date.now().toString());
        await this.database.clearData();
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
    if (this.isDevMode) {
      return;
    }
    const direction = optIn ? "in" : "out";
    try {
      const response = await this.post({
        eventType: "ping",
        dimensions: {
          optIn,
        },
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
  public async getDailyStats(): Promise<IMetrics> {
    return {
      measures: await this.database.getCounters(),
      customEvents: await this.database.getCustomEvents(),
      timings: await this.database.getTimings(),
      dimensions: {
        appVersion: this.version,
        platform: process.platform,
        guid: getGUID(),
        eventType: "usage",
        date: getISODate(),
        language: process.env.LANG || "",
        gitHubUser: this.gitHubUser,
      },
    };
  }

  public async addCustomEvent(eventType: string, event: object) {
    await this.database.addCustomEvent(eventType, event);
  }

  /**
   * Add timing data to the stats store, to be sent with the daily metrics requests.
   */
  public async addTiming(eventType: string, durationInMilliseconds: number, metadata = {}) {
    // don't increment in dev mode because localStorage
    // is shared across dev and non dev windows and there's
    // no way to keep dev and non-dev metrics separate.
    // don't increment if the user has opted out, because
    // we want to respect user privacy.
    if (this.isDevMode || this.optOut) {
      return;
    }
    await this.database.addTiming(eventType, durationInMilliseconds, metadata);
  }

  /**
   * Increment a counter.  This is used to track usage statistics.
   */
  public async incrementCounter(counterName: string) {
    // don't increment in dev mode because localStorage
    // is shared across dev and non dev windows and there's
    // no way to keep dev and non-dev metrics separate.
    // don't increment if the user has opted out, because
    // we want to respect user privacy.
    if (this.isDevMode || this.optOut) {
      return;
    }
    await this.database.incrementCounter(counterName);
  }

  /** Post some data to our stats endpoint.
   * This is public for testing purposes only.
   */
  public async post(body: object): Promise<Response> {
    if (this.verboseMode) {
      console.log("Sending metrics", body);
    }

    const requestHeaders: {[name: string]: string} = { "Content-Type": "application/json" };
    const token = this.getAccessToken();
    if (token) {
      requestHeaders.Authorization = `token ${token}`;
    }
    const options = {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body),
    };

    return this.fetch(this.appUrl, options);
  }

  /** Exists to enable us to mock fetch in tests
   * This is public for testing purposes only.
   */
  public async fetch(url: string, options: object): Promise<Response> {
    return fetch(url, options);
  }

  /** Should the app report its daily stats?
   * Public for testing purposes only.
   */
  public hasReportingIntervalElapsed(): boolean {

    const lastDateString = localStorage.getItem(LastDailyStatsReportKey);
    let lastDate = 0;
    if (lastDateString && lastDateString.length > 0) {
      lastDate = parseInt(lastDateString, 10);
    }

    if (isNaN(lastDate)) {
      lastDate = 0;
    }

    const now = Date.now();
    return (now - lastDate) > this.reportingFrequency;
  }

  /** Set a timer so we can report the stats when the time comes. */
  private getTimer(loopInterval: number): NodeJS.Timer {
    // todo (tt, 5/2018): maybe we shouldn't even set up the timer
    // in dev mode or if the user has opted out.
    const timer = setInterval(() => {
      if (this.hasReportingIntervalElapsed()) {
        this.reportStats();
      }
    }, loopInterval);

    if (timer.unref !== undefined) {
      // make sure we don't block node from exiting in tests
      // https://stackoverflow.com/questions/48172363/mocha-test-suite-never-ends-when-setinterval-running
      timer.unref();
    }
    return timer;
  }
}
