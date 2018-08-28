import { IStatsDatabase, ISettings, IMetrics } from "telemetry-github";
import { uuid } from "./uuid";
import { LocalStorage } from "./storage";
import StatsDatabase from "./database";
import { IncomingMessage, RequestOptions } from "http";
import * as https from "https";
import { ReportError, PingError } from "./errors";

export const enum AppName {
  Atom = "atom",
  VSCode = "vscode",
}

// if you're running a local instance of central, use
// const USAGE_HOST = 'localhost';
// const USAGE_PROTOCOL = 'http:'
// const USAGE_PORT = '4000'
const USAGE_HOST = "central.github.com";
const USAGE_PROTOCOL = "https:";
const USAGE_PORT: string | undefined = undefined;

const USAGE_PATH = "/api/usage/";

export const StatsGUIDKey = "stats-guid";

export const LastDailyStatsReportKey = "last-daily-stats-report";

/** The localStorage key for whether the user has opted out. */
export const StatsOptOutKey = "stats-opt-out";

/** Have we successfully sent the stats opt-in? */
export const HasSentOptInPingKey = "has-sent-stats-opt-in-ping";

/** milliseconds in an hour (for readability, dawg) */
const minutes = 60 * 1000;
const hours = 60 * minutes;

/** How often daily stats should be submitted (i.e., 24 hours). */
export const DailyStatsReportIntervalInMs = hours * 24;

/** How often (in milliseconds) we check to see if it's time to report stats. */
export const ReportingLoopIntervalInMs = minutes * 5; // every 5 minutes

/** helper for getting the date, which we pass in so that we can mock
 * in unit tests.
 */
const getISODate = () => new Date(Date.now()).toISOString();

export class StatsStore {

  private get isEnabled(): boolean {
    return !this.optOut && (!this.isDevMode || this.trackInDevMode);
  }
  private timer: NodeJS.Timer | undefined;

  /** Has the user opted out of stats reporting? */
  private optOut: boolean = false;

  /** api for calling central with our stats */
  private usagePath: string;

  /** which version are we running, dawg */
  private version: string;

  /** is app running in development mode? */
  private isDevMode: boolean = false;
  private trackInDevMode: boolean = false;

  /** function for getting GitHub access token if one exists.
   * We don't want to store the token, due to security concerns, and also
   * because the token might expire.
   */
  private getAccessToken: () => string;

  private gitHubUser: string | undefined;

  private guid: string | undefined;

  public constructor(
    appName: AppName,
    version: string,
    getAccessToken = () => "",
    private settings: ISettings = new LocalStorage(),
    private database: IStatsDatabase = new StatsDatabase(getISODate)
  ) {
    this.version = version;
    this.usagePath = USAGE_PATH + appName;
    this.getAccessToken = getAccessToken;
    this.timer = this.getTimer(ReportingLoopIntervalInMs);
  }

  public async shutdown(): Promise<void> {
    this.database.close();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  public setGitHubUser(gitHubUser: string) {
    this.gitHubUser = gitHubUser;
  }

  public setDevMode(isDevMode: boolean): void {
    this.isDevMode = isDevMode;
  }

  public setTrackInDevMode(track: boolean): void {
    this.trackInDevMode = track;
  }

  /** Set whether the user has opted out of stats reporting. */
  public async setOptOut(optOut: boolean): Promise<void> {
    await this.initialize();

    const changed = this.optOut !== optOut;

    this.optOut = optOut;

    await this.settings.setItem(StatsOptOutKey, optOut ? "1" : "0");

    if (changed && (!this.isDevMode || this.trackInDevMode)) {
      await this.sendOptInStatusPing(!optOut);
    }
  }

  public async addCustomEvent(eventType: string, event: object) {
    await this.initialize();

    if (!this.isEnabled) { return; }

    await this.database.addCustomEvent(eventType, event);
  }

  /**
   * Add timing data to the stats store, to be sent with the daily metrics requests.
   */
  public async addTiming(eventType: string, durationInMilliseconds: number, metadata = {}) {
    await this.initialize();

    if (!this.isEnabled) { return; }

    await this.database.addTiming(eventType, durationInMilliseconds, metadata);
  }

  /**
   * Increment a counter.  This is used to track usage statistics.
   */
  public async incrementCounter(counterName: string) {
    await this.initialize();

    if (!this.isEnabled) { return; }

    await this.database.incrementCounter(counterName);
  }

  public async reportStats(getDate: () => string) {
    await this.initialize();

    if (!this.isEnabled) { return; }

    const stats = await this.getDailyStats(getDate);

    const response = await this.post(stats);

    if (response.statusCode !== 200) {
      throw new ReportError(response.statusCode);
    } else {
      await this.settings.setItem(LastDailyStatsReportKey, Date.now().toString());
      await this.database.clearData();
      console.log("stats successfully reported");
    }
  }

  // ====== Internal Helpers =====

  /* send a ping to indicate that the user has changed their opt-in preferences.
  * public for testing purposes only.
  */
  public async sendOptInStatusPing(optIn: boolean): Promise<void> {
    await this.initialize();

    const direction = optIn ? "in" : "out";

    const response = await this.post({
      eventType: "ping",
      dimensions: {
        optIn,
      },
    });

    if (response.statusCode !== 200) {
      throw new PingError(response.statusCode);
    }
    this.settings.setItem(HasSentOptInPingKey, "1");

    console.log(`Opt ${direction} reported.`);
  }

  // public for testing purposes only
  public async getDailyStats(getDate: () => string): Promise<IMetrics> {
    await this.initialize();

    const measures: any = {};
    (await this.database.getCounters()).forEach((x, _, __) => measures[x.name] = x.count);

    return {
      measures,
      customEvents: await this.database.getCustomEvents(),
      timings: await this.database.getTimings(),
      dimensions: {
        appVersion: this.version,
        platform: process.platform,
        guid: this.guid!,
        eventType: "usage",
        date: getDate(),
        language: process.env.LANG || "",
        gitHubUser: this.gitHubUser,
      },
    };
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
      } catch (e) {
        reject(e);
      }
    });
  }

  /** Should the app report its daily stats?
   * Public for testing purposes only.
   */
  public async hasReportingIntervalElapsed(): Promise<boolean> {
    const lastDateString = await this.settings.getItem(LastDailyStatsReportKey);
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

  private async initialize(): Promise<void> {
    if (this.guid) { return; }
    this.guid = await this.getGUID();

    const optOutValue = await this.settings.getItem(StatsOptOutKey);
    if (optOutValue) {
      this.optOut = !!parseInt(optOutValue, 10);

      // If the user has set an opt out value but we haven't sent the ping yet,
      // give it a shot now.
      if (!(await this.settings.getItem(HasSentOptInPingKey))) {
        if (!this.isDevMode || this.trackInDevMode) {
          await this.sendOptInStatusPing(!this.optOut);
        }
      }
    } else {
      this.optOut = false;
    }
  }

  /** Set a timer so we can report the stats when the time comes. */
  private getTimer(loopInterval: number): NodeJS.Timer {
    if (this.timer) {
      clearInterval(this.timer);
    }
    // todo (tt, 5/2018): maybe we shouldn't even set up the timer
    // in dev mode or if the user has opted out.
    this.timer = setInterval(() => {
      if (this.hasReportingIntervalElapsed()) {
        this.reportStats(getISODate);
      }
    }, loopInterval);
    return this.timer;
  }

  private async getGUID(): Promise<string> {
    let guid = await this.settings.getItem(StatsGUIDKey);
    if (!guid) {
      guid = uuid();
      this.settings.setItem(StatsGUIDKey, guid);
    }
    return guid;
  }
}
