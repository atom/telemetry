import { assert } from "chai";
import StatsDatabase from "../src/database";
import { IMetrics } from "telemetry-github";
import sinon = require("sinon");

const getDate = () => new Date(Date.now()).toISOString();

const grammar = "javascript";
const openEventType = "open";
const getOpenEvent = (): any => ({ grammar, eventType: openEventType, date: getDate() });

const deprecateEventType = "deprecate";
const message = "oh noes";
const getDeprecateEvent = (): any => ({ message, eventType: deprecateEventType, date: getDate() });
const dayInMs = 24 * 60 * 60 * 1000;

const getTiming = (eventType: string, durationInMilliseconds: number, metadata: any): any => ({
  eventType,
  durationInMilliseconds,
  metadata,
  date: getDate(),
});

const createReport = (): IMetrics => {
  return {
    measures: {},
    customEvents: [],
    timings: [],
    dimensions: {
      appVersion: "1.0",
      platform: process.platform,
      guid: "GUID",
      eventType: "usage",
      date: getDate(),
      language: "en-US",
      gitHubUser: undefined,
    },
  };
};

describe("database", async function() {
  const counterName = "commits";
  let clock: sinon.SinonFakeTimers;

  let database: StatsDatabase;
  beforeEach(async function() {
    clock = sinon.useFakeTimers();
    database = new StatsDatabase(createReport);
  });
  afterEach(async function() {
    await database.clearData();
    await database.close();
    clock.restore();
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
      const events = (await database.getMetrics())[0].customEvents;
      assert.deepEqual(events[0], getOpenEvent());
    });
    it("adds multiple events", async function() {
      await database.addCustomEvent(openEventType, { grammar });
      await database.addCustomEvent(deprecateEventType, { message });
      const events = (await database.getMetrics())[0].customEvents;
      assert.deepEqual(events, [getOpenEvent(), getDeprecateEvent()]);
    });
  });
  describe("timing methods", function() {
    it("adds and gets a single timer", async function() {
      const eventType = "load";
      const durationInMilliseconds = 100;
      const metadata = { meta: "data" };
      await database.addTiming(eventType, durationInMilliseconds, metadata);

      const timings = (await database.getMetrics())[0].timings;
      assert.deepEqual(timings[0], { eventType, durationInMilliseconds, metadata, date: getDate() });
    });
    it("adds and gets multiple timers", async function() {
      const eventType = "load";
      const durationInMilliseconds1 = 100;
      const durationInMilliseconds2 = 200;
      const metadata = { meta: "data" };
      await database.addTiming(eventType, durationInMilliseconds1, metadata);
      await database.addTiming(eventType, durationInMilliseconds2, metadata);

      const timings = (await database.getMetrics())[0].timings;
      assert.deepEqual(timings, [
        getTiming(eventType, durationInMilliseconds1, metadata),
        getTiming(eventType, durationInMilliseconds2, metadata),
      ]);
    });
  });
  describe("incrementCounter", function() {
    it("adds a new counter if it does not exist", async function() {
      const metrics = await database.getMetrics();
      assert.deepEqual(metrics, []);
      await database.incrementCounter(counterName);
      const counters = (await database.getMetrics())[0].measures;
      assert.deepEqual(counters, { [counterName]: 1 });
    });
    it("increments an existing counter", async function() {
      await database.incrementCounter(counterName);
      let counters = (await database.getMetrics())[0].measures;
      assert.deepEqual(counters, { [counterName]: 1 });
      await database.incrementCounter(counterName);
      counters = (await database.getMetrics())[0].measures;
      assert.deepEqual(counters, { [counterName]: 2 });
    });
  });
  describe("getCounters", function() {
    it("gets an empty object if counters do not exist", async function() {
      await database.addCustomEvent(openEventType, { grammar });
      let counters = (await database.getMetrics())[0].measures;
      assert.deepEqual(counters, {});
    });
    it("gets a single counter if it exists", async function() {
      await database.incrementCounter(counterName);
      let counters = (await database.getMetrics())[0].measures;
      assert.deepEqual(counters, { [counterName]: 1 });
    });
    it("gets all counters that exist", async function() {
      await database.incrementCounter(counterName);
      await database.incrementCounter("foo");
      let counters = (await database.getMetrics())[0].measures;
      assert.deepEqual(counters, { [counterName]: 1, foo: 1 });
    });
  });
  describe("clearData", function() {
    it("clears all", async function() {
      await database.incrementCounter(counterName);

      let actual = await database.getMetrics();
      let expected = createReport();
      expected.measures[counterName] = 1;
      assert.deepEqual(actual, [expected]);

      clock.tick(dayInMs);
      const now = new Date(Date.now());
      await database.clearData(now);

      let metrics = await database.getMetrics();
      assert.deepEqual(metrics, []);
    });
    it("clears old records", async function() {
      await database.incrementCounter(counterName);
      await database.addCustomEvent(openEventType, { grammar });
      await database.addTiming("load", 100, { meta: "data" });

      let now = new Date(Date.now());
      let metrics = await database.getMetrics();
      let expected = createReport();
      expected.measures[counterName] = 1;
      expected.customEvents.push(getOpenEvent());
      expected.timings.push(getTiming("load", 100, { meta: "data" }));
      assert.deepEqual(metrics, [expected]);

      clock.tick(dayInMs);
      now = new Date(Date.now());
      await database.clearData(now);

      metrics = await database.getMetrics();
      assert.deepEqual(metrics, []);
    });
    it("clearing an empty db does not throw an error", async function() {
      await database.clearData();
    });
  });
});
