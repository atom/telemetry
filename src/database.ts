import * as loki from "lokijs";
import { IStatsDatabase, IMetrics } from "telemetry-github";
import { getYearMonthDay } from ".";

interface IDBEntry {
  date: number;
  instanceId: string;
  metrics: IMetrics;
}

const now = () => new Date(Date.now()).toISOString();

export default class StatsDatabase implements IStatsDatabase {
  private db: loki;

  private metrics: Collection<IDBEntry>;

  public constructor(private createCurrentReport: () => IMetrics) {
    this.db = new loki("stats-database");
    this.metrics = this.db.addCollection("metrics");
  }

  public async close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.close(e => {
        if (e) {
          reject(e);
        } else {
          resolve();
        }
      });
    });
  }

  public async addCustomEvent(instanceId: string, eventType: string, customEvent: any): Promise<void> {
    const report = await this.getCurrentDBEntry(instanceId);
    customEvent.date = now();
    customEvent.eventType = eventType;
    report.metrics.customEvents.push(customEvent);

    await this.metrics.update(report);
  }

  public async incrementCounter(instanceId: string, counterName: string): Promise<void> {
    const report = await this.getCurrentDBEntry(instanceId);

    if (!report.metrics.measures.hasOwnProperty(counterName)) {
      report.metrics.measures[counterName] = 0;
    }
    report.metrics.measures[counterName]++;
    await this.metrics.update(report);
  }

  public async addTiming(
    instanceId: string,
    eventType: string,
    durationInMilliseconds: number,
    metadata = {}
  ): Promise<void> {
    const report = await this.getCurrentDBEntry(instanceId);
    report.metrics.timings.push({ eventType, durationInMilliseconds, metadata, date: now() });
    await this.metrics.update(report);
  }

  /** Clears all values that exist in the database.
   * returns nothing.
   */
  public async clearData(date?: Date): Promise<void> {
    if (!date) {
      await this.metrics.clear();
    } else {
      const today = getYearMonthDay(date);
      await this.metrics.findAndRemove({ date: { $lt: today } });
    }
  }

  public async getMetrics(beforeDate?: Date): Promise<IMetrics[]> {
    if (beforeDate) {
      const today = getYearMonthDay(beforeDate);
      return this.metrics.find({ date: { $lt: today } }).map(x => x.metrics);
    } else {
      return this.metrics.find().map(x => x.metrics);
    }
  }

  public async getCurrentMetrics(instanceId: string): Promise<IMetrics> {
    return this.getCurrentDBEntry(instanceId).then(x => x.metrics);
  }

  private async getCurrentDBEntry(instanceId: string): Promise<IDBEntry> {
    let report = await this.metrics.findOne({ instanceId });

    if (!report) {
      const newReport = this.createCurrentReport();
      const today = getYearMonthDay(new Date(Date.now()));
      report = (await this.metrics.insertOne({ date: today, instanceId, metrics: newReport })) || null;
    }
    return report!;
  }
}
