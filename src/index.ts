const rp = require("request-promise");

// const baseUsageApi = 'https://central.github.com/api/usage/';

const baseUsageApi = "http://localhost:4000/api/usage/";

const LastDailyStatsReportKey = "last-daily-stats-report";

/** The localStorage key for whether the user has opted out. */
const StatsOptOutKey = "stats-opt-out";

/** Have we successfully sent the stats opt-in? */
const HasSentOptInPingKey = "has-sent-stats-opt-in-ping";

/** How often daily stats should be submitted (i.e., 24 hours). */
const DailyStatsReportInterval = 1000 * 60 * 60 * 24;

interface ICalculatedStats {
  /** The app version. */
  readonly version: string;

  readonly chromeUserAgent: string;

  /** The install ID. */
  readonly guid: string;

  /** GitHub api access token, if the user is authenticated */
  readonly accessToken: string;

  readonly eventType: "usage";
}

/** The goal is for this package to be app-agnostic so we can add
 * other editors in the future.
 */
export enum AppName {
  Atom = 'atom',
};

export class StatsStore {

  /** Has the user opted out of stats reporting? */
  private optOut: boolean;

  private appUrl: String;

  public constructor(appName: AppName) {
    this.appUrl = baseUsageApi + appName;
    const optOutValue = localStorage.getItem(StatsOptOutKey);

    if (optOutValue) {
      this.optOut = !!parseInt(optOutValue, 10);

      // If the user has set an opt out value but we haven't sent the ping yet,
      // give it a shot now.
      if (!localStorage.getItem(HasSentOptInPingKey)) {
        // this.sendOptInStatusPing(!this.optOut);
      }
    } else {
      this.optOut = false;
    }
  }

  public async reportStats() {
    // todo: obviously replace this with a real stats event.
    const stats = {foo: "bazz"};

    try {
      const response = await this.post(stats);
      if (!response.ok) {
        throw new Error(`Unexpected status: ${response.statusText} (${response.status})`);
      }
      else {
        console.log('stats successfully reported');
      }
    } catch (err) {
      console.log(err);
    }
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

  /** Post some data to our stats endpoint. 
   * This is public for testing purposes only.
  */
  public async post(body: object): Promise<Response> {
    const options = {
      url: this.appUrl,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };

    return await rp(options);
  }
}
