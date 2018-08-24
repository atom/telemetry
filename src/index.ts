import { uuid } from "./uuid";
import StatsDatabase from "./database";
import { LocalStorage } from "./storage";
import { IStorage } from "./interfaces";
import * as https from 'https';
import { IncomingMessage, RequestOptions } from "http";

// if you're running a local instance of central, use
// const USAGE_HOST = 'localhost';
// const USAGE_PROTOCOL = 'http:'
// const USAGE_PORT = '4000'
const USAGE_HOST = 'central.github.com';
const USAGE_PROTOCOL = 'https:'
const USAGE_PORT: string | undefined = undefined;

const USAGE_PATH = 'api/usage/';

export const StatsGUIDKey = "stats-guid";

export const LastDailyStatsReportKey = "last-daily-stats-report";

/** The localStorage key for whether the user has opted out. */
export const StatsOptOutKey = "stats-opt-out";

/** Have we successfully sent the stats opt-in? */
export const HasSentOptInPingKey = "has-sent-stats-opt-in-ping";

/** milliseconds in an hour (for readability, dawg) */
const hours = 60 * 60 * 1000;

/** How often daily stats should be submitted (i.e., 24 hours). */
export const DailyStatsReportIntervalInMs = hours * 24;

/** How often (in milliseconds) we check to see if it's time to report stats. */
export const ReportingLoopIntervalInMs = hours * 4;

/** The goal is for this package to be app-agnostic so we can add
 * other editors in the future.
 */
export enum AppName {
  Atom = "atom",
  VSCode = "vscode",
}

/** helper for getting the date, which we pass in so that we can mock
 * in unit tests.
 */
const getISODate = () => new Date(Date.now()).toISOString();

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

export class StatsStore {
  private timer: NodeJS.Timer;

  /** Has the user opted out of stats reporting? */
  private optOut: boolean;

  /** api for calling central with our stats */
  private usagePath: string;

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
  private database = new StatsDatabase(getISODate);

  /** function for getting GitHub access token if one exists.
   * We don't want to store the token, due to security concerns, and also
   * because the token might expire.
   */
  private getAccessToken: () => string;

  private gitHubUser: string | undefined;

  private guid: string;

  public constructor(
    appName: AppName,
    version: string,
    isDevMode: boolean,
    getAccessToken = () => "",
    private storage: IStorage = new LocalStorage()
  ) {
    this.version = version;
    this.usagePath = USAGE_PATH + appName;
    this.isDevMode = isDevMode;
    this.getAccessToken = getAccessToken;
    this.guid = this.getGUID();
    this.timer = this.getTimer(ReportingLoopIntervalInMs);

    const optOutValue = storage.getItem(StatsOptOutKey);
    if (optOutValue) {
      this.optOut = !!parseInt(optOutValue, 10);

      // If the user has set an opt out value but we haven't sent the ping yet,
      // give it a shot now.
      if (!storage.getItem(HasSentOptInPingKey)) {
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

    this.storage.setItem(StatsOptOutKey, optOut ? "1" : "0");

    if (changed) {
      await this.sendOptInStatusPing(!optOut);
    }
  }

  public async reportStats(getDate: () => string) {
    if (this.optOut || this.isDevMode) {
      return;
    }
    const stats = await this.getDailyStats(getDate);

    const response = await this.post(stats);
    if (response.statusCode !== 200) {
      throw new Error(`Stats reporting failure: ${response.statusCode})`);
    } else {
      await this.storage.setItem(LastDailyStatsReportKey, Date.now().toString());
      await this.database.clearData();
      console.log("stats successfully reported");
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

    const response = await this.post({
      eventType: "ping",
      dimensions: {
        optIn,
      },
    });
    if (response.statusCode !== 200) {
      throw new Error(`Error sending opt in ping: ${response.statusCode}`);
    }
    this.storage.setItem(HasSentOptInPingKey, "1");

    console.log(`Opt ${direction} reported.`);
  }

  // public for testing purposes only
  public async getDailyStats(getDate: () => string): Promise<IMetrics> {
    return {
      measures: await this.database.getCounters(),
      customEvents: await this.database.getCustomEvents(),
      timings: await this.database.getTimings(),
      dimensions: {
        appVersion: this.version,
        platform: process.platform,
        guid: this.guid,
        eventType: "usage",
        date: getDate(),
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
  public async post(body: object): Promise<IncomingMessage> {
    const requestHeaders: { [name: string]: string } = { "Content-Type": "application/json" };
    const token = this.getAccessToken();
    if (token) {
      requestHeaders.Authorization = `token ${token}`;
    }
    const options: RequestOptions = {
      hostname: USAGE_HOST,
      protocol: USAGE_PROTOCOL,
      method: "POST",
      path: this.usagePath,
      headers: requestHeaders
    };
    if (USAGE_PORT) {
      options.port = USAGE_PORT;
    }

    return this.fetch(options, JSON.stringify(body));
  }

  /** Exists to enable us to mock fetch in tests
   * This is public for testing purposes only.
   */
  public async fetch(options: RequestOptions, body: string): Promise<IncomingMessage> {
    return new Promise<IncomingMessage>((resolve, reject) => {
      try {
        const post = https.request(options, postResponse => {
          resolve(postResponse);
        });
        post.write(body);
        post.end();
      } catch(e) {
        reject(e);
      }
    });
  }

  /** Should the app report its daily stats?
   * Public for testing purposes only.
   */
  public hasReportingIntervalElapsed(): boolean {
    const lastDateString = this.storage.getItem(LastDailyStatsReportKey);
    let lastDate = 0;
    if (lastDateString && lastDateString.length > 0) {
      lastDate = parseInt(lastDateString, 10);
    }

    if (isNaN(lastDate)) {
      lastDate = 0;
    }

    const now = Date.now();
    return now - lastDate > DailyStatsReportIntervalInMs;
  }

  /** Set a timer so we can report the stats when the time comes. */
  private getTimer(loopInterval: number): NodeJS.Timer {
    // todo (tt, 5/2018): maybe we shouldn't even set up the timer
    // in dev mode or if the user has opted out.
    const timer = setInterval(() => {
      if (this.hasReportingIntervalElapsed()) {
        this.reportStats(getISODate);
      }
    }, loopInterval);

    if (timer.unref !== undefined) {
      // make sure we don't block node from exiting in tests
      // https://stackoverflow.com/questions/48172363/mocha-test-suite-never-ends-when-setinterval-running
      timer.unref();
    }
    return timer;
  }

  private getGUID(): string {
    let guid = this.storage.getItem(StatsGUIDKey);
    if (!guid) {
      guid = uuid();
      this.storage.setItem(StatsGUIDKey, guid);
    }
    return guid;
  }
}
