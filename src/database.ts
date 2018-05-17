import * as loki from "lokijs";

export default class MeasuresDatabase {
  private database: Collection<any>;

  public constructor() {
    const db = new loki("stats-measures");
    this.database = db.addCollection("measures");
  }

  public async incrementMeasure(measureName: string) {
    const existing = await this.getUnformattedMeasure(measureName);
    if (existing) {
      existing.count += 1;
      this.database.update(existing);
    } else {
      this.database.insert({ name: measureName, count: 1});
    }
  }

  /** Clears all measures that exist in the store.
   * returns nothing.
   */
  public async clearMeasures() {
    await this.database.findAndRemove();
  }

  /** Get all measures.
   * This method strips the lokijs metadata, which external
   * callers shouldn't care about.
   * Takes a string, which is the measure name.
   * Returns something like { commits: 7, coAuthoredCommits: 8 }.
   */
  public async getMeasures():
    Promise<{[name: string]: number}> {
    const measures: { [name: string]: number } = {};
    this.database.find().forEach((measure) => {
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
    const existing = await this.database.find({ name: measureName });

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
