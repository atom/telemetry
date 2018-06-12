import * as loki from "lokijs";

export default class MeasuresDatabase {
  private measures: Collection<any>;
  private events: Collection<any>;

  public constructor() {
    const db = new loki("stats-measures");
    this.measures = db.addCollection("measures");
    this.events = db.addCollection("events");
  }

  public async addCustomEvent(customEvent: object) {
    this.events.insert(customEvent);
  }

  public async incrementMeasure(measureName: string) {
    const existing = await this.getUnformattedMeasure(measureName);
    if (existing) {
      existing.count += 1;
      this.measures.update(existing);
    } else {
      this.measures.insert({ name: measureName, count: 1});
    }
  }

  /** Clears all values that exist in the database.
   * returns nothing.
   */
  public async clearData() {
    await this.measures.clear();
    await this.events.clear();
  }

  public async getEvents(): Promise<object[]> {
    const events = await this.events.find();
    events.forEach((event) => {
      // honey badger don't care about lokijis meta data.
      delete event.$loki;
      delete event.meta;
    });
    return events;
  }

  /** Get all measures.
   * This method strips the lokijs metadata, which external
   * callers shouldn't care about.
   * Returns something like { commits: 7, coAuthoredCommits: 8 }.
   */
  public async getMeasures():
    Promise<{[name: string]: number}> {
    const measures: { [name: string]: number } = {};
    this.measures.find().forEach((measure) => {
      measures[measure.name] = measure.count;
    });
    return measures;
  }

  /** Get a single measure.
   * Don't strip lokijs metadata, because if we want to update existing
   * items we need to pass that shizz back in.
   * Returns something like:
   * [ { name: 'coAuthoredCommits',count: 1, meta: { revision: 0, created: 1526592157642, version: 0 },'$loki': 1 } ]
   */
  private async getUnformattedMeasure(measureName: string) {
    const existing = await this.measures.find({ name: measureName });

    if (existing.length > 1) {
      // we should never get into this situation because if we are using the lokijs
      // api properly it should overwrite existing items with the same name.
      // but I've seen things (in prod) you people wouldn't believe.
      // Attack ships on fire off the shoulder of Orion.
      // Cosmic rays flipping bits and influencing the outcome of elections.
      // So throw an error just in case.
      throw new Error("multiple measures with the same name");
    } else if (existing.length < 1) {
      return null;
    } else {
      return existing[0];
    }
  }
}
