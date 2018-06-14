import { assert } from "chai";
import MeasuresDatabase from "../src/database";

const getDate = () => {
  return "2018-05-16T21:54:24.500Z";
};

// inserting into lokijs mutates the passed-in object
// so that you can't insert the same object twice. In prod this
// shouldn't be a problem because you'd use a new object for each event,
// but for test fixtures where we want to reuse objects it's a problem.
// thus, these functions that return a new object every time.
function getEvent1() {
  return { type: "open", grammar: "javascript" };
}

function getEvent2() {
  return { type: "deprecation", message: "woop woop" };
}

function addDate(event: any) {
  event.date = getDate();
  return event;
}

describe("measuresDb", async function() {
  const measureName = "commits";

  let measuresDb: MeasuresDatabase;
  beforeEach(async function() {
    measuresDb = new MeasuresDatabase(getDate);
  });
  describe("addCustomEvent", async function() {
    it("adds a single event", async function() {
      await measuresDb.addCustomEvent(getEvent1());
      const events: any = await measuresDb.getCustomEvents();
      assert.deepEqual(addDate(getEvent1()), events[0]);
    });
    it("adds multiple events", async function() {
      await measuresDb.addCustomEvent(getEvent1());
      await measuresDb.addCustomEvent(getEvent2());
      const events: any = await measuresDb.getCustomEvents();
      assert.deepEqual([addDate(getEvent1()), addDate(getEvent2())], events);
    });
  });
  describe("incrementMeasure", async function() {
    it("adds a new measure if it does not exist", async function() {
      const measure = await measuresDb.getMeasures();
      assert.deepEqual(measure, {});
      await measuresDb.incrementMeasure(measureName);
      const incrementedMeasure = await measuresDb.getMeasures();
      assert.deepEqual(incrementedMeasure, {[measureName]: 1});
    });
    it("increments an existing measure", async function() {
      await measuresDb.incrementMeasure(measureName);
      const measure = await measuresDb.getMeasures();
      assert.deepEqual(measure, {[measureName]: 1});
      await measuresDb.incrementMeasure(measureName);
      const incrementedMeasure = await measuresDb.getMeasures();
      assert.deepEqual(incrementedMeasure, { [measureName]: 2});
    });
  });
  describe("getMeasures", async function() {
  it("gets an empty object if measures do not exist", async function() {
    const measure = await measuresDb.getMeasures();
    assert.deepEqual(measure, {});
  });
  it("gets a single measure if it exists", async function() {
    await measuresDb.incrementMeasure(measureName);
    const measure = await measuresDb.getMeasures();
    assert.deepEqual(measure, { [measureName]: 1 });
  });
  it("gets all measures that exist", async function() {
    await measuresDb.incrementMeasure(measureName);
    await measuresDb.incrementMeasure("foo");
    const measures = await measuresDb.getMeasures();
    assert.deepEqual(measures, { [measureName]: 1, foo: 1});
  });
  });
  describe("clearMeasures", async function() {
    it("clears db containing single measure", async function() {
      await measuresDb.incrementMeasure(measureName);
      await measuresDb.clearData();
      const measures = await measuresDb.getMeasures();
      assert.deepEqual(measures, {});
    });
    it("clears db containing multiple measures", async function() {
      await measuresDb.incrementMeasure(measureName);
      await measuresDb.incrementMeasure(measureName);
      await measuresDb.incrementMeasure("foo");
      await measuresDb.clearData();
      const measures = await measuresDb.getMeasures();
      assert.deepEqual(measures, {});
    });
    it("clears db containing single customEvent", async function() {
      await measuresDb.addCustomEvent(getEvent1());

      await measuresDb.clearData();
      const events = await measuresDb.getCustomEvents();

      assert.deepEqual(events, []);
    });
    it("clears db containing multiple customEvents", async function() {
      await measuresDb.addCustomEvent(getEvent1());
      await measuresDb.addCustomEvent(getEvent2());

      await measuresDb.clearData();
      const events = await measuresDb.getCustomEvents();

      assert.deepEqual(events, []);
    });
    it("clearing an empty db does not throw an error", async function() {
      const measures = await measuresDb.getMeasures();
      assert.deepEqual(measures, {});

      const events = await measuresDb.getCustomEvents();
      assert.deepEqual(events, []);

      await measuresDb.clearData();
    });
  });
});
