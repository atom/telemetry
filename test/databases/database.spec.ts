import { assert } from "chai";
import {BaseDatabase} from "../../src/databases/base";
import LokiDatabase from "../../src/databases/loki";
import IndexedDBDatabase from "../../src/databases/indexeddb";

const grammar = "javascript";
const openEventType = "open";
const openEvent = { grammar, eventType: openEventType};

const deprecateEventType = "deprecate";
const message = "oh noes";
const deprecateEvent = { message, eventType: deprecateEventType };

for (const DatabaseImpl of [LokiDatabase, IndexedDBDatabase]) {
describe(`database - ${DatabaseImpl.name}`, async function() {
  const counterName = "commits";
  let database: BaseDatabase;

  beforeEach(async function() {
    database = new DatabaseImpl();
  });

  afterEach(async function() {
    await database.clearData();
  });

  // inserting into lokijs mutates the passed-in object
  // so that you can't insert the same object twice.
  // in real life this isn't a problem because you'd be passing in a new
  // object every time, but it makes test fixtures annoying.
  // So just make a new object in every test when you're inserting and move on with your life.
  describe("custom event methods", async function() {
    it("adds and gets a single event", async function() {
      await database.addCustomEvent(openEventType, { grammar });
      const rawEvents = await database.getCustomEvents();
      const events = rawEvents.map(({date, ...rest}) => rest);

      assert.deepEqual(events[0], openEvent);
    });
    it("adds multiple events", async function() {
      await database.addCustomEvent(openEventType, { grammar });
      await database.addCustomEvent(deprecateEventType, { message });
      const rawEvents = await database.getCustomEvents();
      const events = rawEvents.map(({date, ...rest}) => rest);

      assert.deepEqual(events, [openEvent, deprecateEvent]);
    });
  });
  describe("timing methods", async function() {
    it("adds and gets a single timer", async function() {
      const eventType = "load";
      const durationInMilliseconds = 100;
      const metadata = { meta: "data" };
      await database.addTiming(eventType, durationInMilliseconds, metadata);

      const [{date, ...timingEvent}] = await database.getTimings();

      assert.deepEqual(timingEvent, { eventType, durationInMilliseconds, metadata });
      assert.isString(date);
    });
    it("adds and gets multiple timers", async function() {
      const eventType = "load";
      const durationInMilliseconds1 = 100;
      const durationInMilliseconds2 = 200;
      const metadata = { meta: "data" };
      await database.addTiming(eventType, durationInMilliseconds1, metadata);
      await database.addTiming(eventType, durationInMilliseconds2, metadata);

      const rawTimings = await database.getTimings();

      // strip the dates from the timing events to make easier assertions.
      const timings = rawTimings.map(({date, ...rest}) => rest);

      assert.deepEqual(
        timings[0],
        { eventType, durationInMilliseconds: durationInMilliseconds1, metadata },
      );
      assert.deepEqual(
        timings[1],
        { eventType, durationInMilliseconds: durationInMilliseconds2, metadata },
      );
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
      await database.addCustomEvent(openEventType, { grammar });

      await database.clearData();
      const events = await database.getCustomEvents();

      assert.deepEqual(events, []);
    });
    it("clears db containing multiple customEvents", async function() {
      await database.addCustomEvent(openEventType, { grammar});
      await database.addCustomEvent(deprecateEventType, { message });

      await database.clearData();
      const events = await database.getCustomEvents();

      assert.deepEqual(events, []);
    });
    it("clears db containing timing", async function() {
      await database.addTiming("load", 100);

      await database.clearData();
      const timings = await database.getTimings();

      assert.deepEqual(timings, []);
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
}
