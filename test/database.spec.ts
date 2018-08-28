import { assert } from "chai";
import StatsDatabase from "../src/database";

const getDate = () => {
  return "2018-05-16T21:54:24.500Z";
};

const grammar = "javascript";
const openEventType = "open";
const openEvent = { grammar, eventType: openEventType, date: getDate() };

const deprecateEventType = "deprecate";
const message = "oh noes";
const deprecateEvent = { message, eventType: deprecateEventType, date: getDate() };

describe("database", async function() {
  const counterName = "commits";

  let database: StatsDatabase;
  beforeEach(function() {
    database = new StatsDatabase(getDate);
  });
  afterEach(async function() {
    await database.close();
  });
  /** Uncomment this to check for async leaks in tests */
  // after(function () {
  //   (<any>global).asyncDump();
  // });

  // inserting into lokijs mutates the passed-in object
  // so that you can't insert the same object twice.
  // in real life this isn't a problem because you'd be passing in a new
  // object every time, but it makes test fixtures annoying.
  // So just make a new object in every test when you're inserting and move on with your life.
  describe("custom event methods", function() {
    it("adds and gets a single event", async function() {
      await database.addCustomEvent(openEventType, { grammar });
      const events: any = await database.getCustomEvents();
      assert.deepEqual(openEvent, events[0]);
    });
    it("adds multiple events", async function() {
      await database.addCustomEvent(openEventType, { grammar });
      await database.addCustomEvent(deprecateEventType, { message });
      const events: any = await database.getCustomEvents();
      assert.deepEqual([openEvent, deprecateEvent], events);
    });
  });
  describe("timing methods", function() {
    it("adds and gets a single timer", async function() {
      const eventType = "load";
      const durationInMilliseconds = 100;
      const metadata = { meta: "data" };
      await database.addTiming(eventType, durationInMilliseconds, metadata);

      const timings = await database.getTimings();
      assert.deepEqual(timings[0], { eventType, durationInMilliseconds, metadata, date: getDate() });
    });
    it("adds and gets multiple timers", async function() {
      const eventType = "load";
      const durationInMilliseconds1 = 100;
      const durationInMilliseconds2 = 200;
      const metadata = { meta: "data" };
      await database.addTiming(eventType, durationInMilliseconds1, metadata);
      await database.addTiming(eventType, durationInMilliseconds2, metadata);

      const timings = await database.getTimings();
      assert.deepEqual(timings[0], { eventType,
        durationInMilliseconds: durationInMilliseconds1, metadata, date: getDate() });
      assert.deepEqual(timings[1], {
        eventType,
        durationInMilliseconds: durationInMilliseconds2, metadata, date: getDate() });
    });
  });
  describe("incrementCounter", function() {
    it("adds a new counter if it does not exist", async function() {
      const counter = await database.getCounters();
      assert.deepEqual(counter, []);
      await database.incrementCounter(counterName);
      const counters = await database.getCounters();
      assert.deepEqual(counters, new Array({name: counterName, count: 1}));
    });
    it("increments an existing counter", async function() {
      await database.incrementCounter(counterName);
      let counters = await database.getCounters();
      assert.deepEqual(counters, new Array({name: counterName, count: 1}));
      await database.incrementCounter(counterName);
      counters = await database.getCounters();
      assert.deepEqual(counters, new Array({name: counterName, count: 2}));
    });
  });
  describe("getCounters", function() {
    it("gets an empty object if counters do not exist", async function() {
      const counter = await database.getCounters();
      assert.deepEqual(counter, []);
    });
    it("gets a single counter if it exists", async function() {
      await database.incrementCounter(counterName);
      const counters = await database.getCounters();
      assert.deepEqual(counters, new Array({name: counterName, count: 1}));
    });
    it("gets all counters that exist", async function() {
      await database.incrementCounter(counterName);
      await database.incrementCounter("foo");
      const counters = await database.getCounters();
      assert.deepEqual(counters, new Array({name: counterName, count: 1}, { name: "foo", count: 1 }));
    });
  });
  describe("clearData", function() {
    it("clears db containing single counter", async function() {
      await database.incrementCounter(counterName);
      await database.clearData();
      const counters = await database.getCounters();
      assert.deepEqual(counters, []);
    });
    it("clears db containing multiple counters", async function() {
      await database.incrementCounter(counterName);
      await database.incrementCounter(counterName);
      await database.incrementCounter("foo");
      await database.clearData();
      const counters = await database.getCounters();
      assert.deepEqual(counters, []);
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
      assert.deepEqual(counters, []);

      const events = await database.getCustomEvents();
      assert.deepEqual(events, []);

      await database.clearData();
    });
  });
});
