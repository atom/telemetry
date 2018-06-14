import { assert } from "chai";
import StatsDatabase from "../src/database";

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

describe("database", async function() {
  const counterName = "commits";

  let database: StatsDatabase;
  beforeEach(async function() {
    database = new StatsDatabase(getDate);
  });
  describe("addCustomEvent", async function() {
    it("adds a single event", async function() {
      await database.addCustomEvent(getEvent1());
      const events: any = await database.getCustomEvents();
      assert.deepEqual(addDate(getEvent1()), events[0]);
    });
    it("adds multiple events", async function() {
      await database.addCustomEvent(getEvent1());
      await database.addCustomEvent(getEvent2());
      const events: any = await database.getCustomEvents();
      assert.deepEqual([addDate(getEvent1()), addDate(getEvent2())], events);
    });
  });
  describe("incrementCounter", async function() {
    it("adds a new counter if it does not exist", async function() {
      const counter = await database.getCounters();
      assert.deepEqual(counter, {});
      await database.incrementCounter(counterName);
      const incrementedCounter = await database.getCounters();
      assert.deepEqual(incrementedCounter, {[counterName]: 1});
    });
    it("increments an existing counter", async function() {
      await database.incrementCounter(counterName);
      const counter = await database.getCounters();
      assert.deepEqual(counter, {[counterName]: 1});
      await database.incrementCounter(counterName);
      const incrementedCounter = await database.getCounters();
      assert.deepEqual(incrementedCounter, { [counterName]: 2});
    });
  });
  describe("getCounters", async function() {
  it("gets an empty object if counters do not exist", async function() {
    const counter = await database.getCounters();
    assert.deepEqual(counter, {});
  });
  it("gets a single counter if it exists", async function() {
    await database.incrementCounter(counterName);
    const counter = await database.getCounters();
    assert.deepEqual(counter, { [counterName]: 1 });
  });
  it("gets all counters that exist", async function() {
    await database.incrementCounter(counterName);
    await database.incrementCounter("foo");
    const measures = await database.getCounters();
    assert.deepEqual(measures, { [counterName]: 1, foo: 1});
  });
  });
  describe("clearData", async function() {
    it("clears db containing single counter", async function() {
      await database.incrementCounter(counterName);
      await database.clearData();
      const counters = await database.getCounters();
      assert.deepEqual(counters, {});
    });
    it("clears db containing multiple counters", async function() {
      await database.incrementCounter(counterName);
      await database.incrementCounter(counterName);
      await database.incrementCounter("foo");
      await database.clearData();
      const counters = await database.getCounters();
      assert.deepEqual(counters, {});
    });
    it("clears db containing single customEvent", async function() {
      await database.addCustomEvent(getEvent1());

      await database.clearData();
      const events = await database.getCustomEvents();

      assert.deepEqual(events, []);
    });
    it("clears db containing multiple customEvents", async function() {
      await database.addCustomEvent(getEvent1());
      await database.addCustomEvent(getEvent2());

      await database.clearData();
      const events = await database.getCustomEvents();

      assert.deepEqual(events, []);
    });
    it("clearing an empty db does not throw an error", async function() {
      const counters = await database.getCounters();
      assert.deepEqual(counters, {});

      const events = await database.getCustomEvents();
      assert.deepEqual(events, []);

      await database.clearData();
    });
  });
});
