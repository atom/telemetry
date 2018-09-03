import { expect, assert } from "chai";
import { AppName, HasSentOptInPingKey, LastDailyStatsReportKey, StatsOptOutKey, StatsStore } from "../src/index";
import * as sinon from "sinon";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { IMetrics } from "telemetry-github";
import { ReportError, PingError } from "../src/errors";
import * as util from "util";
import { uuid } from "../src/uuid";
const setTimeoutPromise = util.promisify(setTimeout);

chai.use(chaiAsPromised);

const getDate = () => new Date(Date.now());

const ACCESS_TOKEN = "SUPER_AWESOME_ACCESS_TOKEN";

const getFilledAccessToken = () => {
  return ACCESS_TOKEN;
};

const getEmptyAccessToken = () => {
  return "";
};

const POST_SUCCESS = { status: 200, statusCode: 200 };
const POST_ERROR = { status: 500, statusCode: 500 };
const POST_STUB = { status: 1000, statusCode: 1000 };

const dayInMs = 24 * 60 * 60 * 1000;

const grammar = "javascript";
const openEventType = "open";
const getOpenEvent = (): any => ({ grammar, eventType: openEventType, date: getDate().toISOString() });

const deprecateEventType = "deprecate";
const message = "oh noes";
const getDeprecateEvent = (): any => ({ message, eventType: deprecateEventType, date: getDate().toISOString() });

const getTiming = (eventType: string, durationInMilliseconds: number, metadata: any): any => ({
  eventType,
  durationInMilliseconds,
  metadata,
  date: getDate().toISOString(),
});

describe("StatsStore", function() {
  const version = "1.2.3";
  let store: StatsStore;
  let postStub: sinon.SinonStub;
  let shouldReportStub: sinon.SinonStub;
  const pingEvent = { eventType: "ping", dimensions: { optIn: false } };
  let accessTokenFunc: () => string = () => "";
  const getAccessToken: () => string = () => accessTokenFunc();
  let clock: sinon.SinonFakeTimers;
  let guid: string;

  let reportFunc: () => IMetrics = () => ({
    measures: {},
    customEvents: [],
    timings: [],
    dimensions: {
      appVersion: "",
      platform: "",
      guid: "",
      eventType: "usage",
      date: "",
      language: "",
      gitHubUser: "",
    },
  });

  let cleanupStore = async function() {
    try {
      (store.post as any).restore();
    } catch {
      // don't care
    }
    await store.shutdown();
  };

  let createReport = function() {
    let report = reportFunc();
    report.dimensions = {
      appVersion: version,
      platform: "platform",
      guid: guid,
      eventType: "usage",
      date: new Date(Date.now()).toISOString(),
      language: "lang",
      gitHubUser: "user",
    };
    return report;
  };

  beforeEach(function() {
    guid = uuid();
    clock = sinon.useFakeTimers(new Date(Date.now()));
    accessTokenFunc = getFilledAccessToken;
    store = new StatsStore(AppName.Atom, version, getAccessToken);
    sinon.stub(store as any, "getGUID").callsFake(async () => guid);
    postStub = sinon.stub(store, "post");
    postStub.resolves(POST_STUB);

    sinon.stub(store, "createReport").callsFake(() => createReport());
  });

  afterEach(async function() {
    await cleanupStore();
    localStorage.clear();
    clock.restore();
  });
  describe("constructor", function() {
    let customStore: StatsStore;
    beforeEach(function() {
      postStub.resolves(POST_SUCCESS);
    });
    afterEach(async function() {
      await customStore.shutdown();
    });

    it("reports stats when hasReportingIntervalElapsed returns true", async function() {
      await cleanupStore();

      customStore = new StatsStore(AppName.Atom, version);
      let reportStub = sinon.stub(customStore, "reportStats");
      shouldReportStub = sinon.stub(customStore as any, "hasReportingIntervalElapsed").callsFake(async () => true);
      clock.tick(2 * 60 * 1000);

      // we need to yield the thread for the rest of the awaited calls to happen
      await setTimeoutPromise(1);
      sinon.assert.called(shouldReportStub);
      sinon.assert.called(reportStub);
    });
    it("does not report stats when shouldReportDailyStats returns false", async function() {
      await cleanupStore();

      customStore = new StatsStore(AppName.Atom, version);
      let reportStub = sinon.stub(customStore, "reportStats");
      shouldReportStub = sinon.stub(customStore as any, "hasReportingIntervalElapsed").callsFake(async () => false);
      clock.tick(2 * 60 * 1000);
      // we need to yield the thread for the rest of the awaited calls to happen
      await setTimeoutPromise(1);

      sinon.assert.called(shouldReportStub);
      sinon.assert.notCalled(reportStub);
    });
    it("obeys custom report intervals", async function() {
      await cleanupStore();

      customStore = new StatsStore(AppName.Atom, version, getAccessToken, undefined, undefined, {
        initialReportDelayInMs: 1000,
      });
      let reportStub = sinon.stub(customStore, "reportStats");

      clock.tick(1000);

      // we need to yield the thread for the rest of the awaited calls to happen
      await setTimeoutPromise(1);
      sinon.assert.calledOnce(reportStub);

      clock.tick(dayInMs);
      // we need to yield the thread for the rest of the awaited calls to happen
      await setTimeoutPromise(1);
      sinon.assert.calledTwice(reportStub);
    });
    it("sends daily", async function() {
      await cleanupStore();

      customStore = new StatsStore(AppName.Atom, version);
      let reportStub = sinon.stub(customStore, "reportStats");

      // go forward a day
      clock.tick(dayInMs);
      // we need to yield the thread for the rest of the awaited calls to happen
      await setTimeoutPromise(1);
      sinon.assert.calledOnce(reportStub);

      // go forward another day
      clock.tick(dayInMs);
      // we need to yield the thread for the rest of the awaited calls to happen
      await setTimeoutPromise(1);
      sinon.assert.calledTwice(reportStub);
    });
  });
  describe("reportStats", async function() {
    let fakeEvent: IMetrics;

    beforeEach(async function() {
      postStub.resolves(POST_SUCCESS);
      await store.incrementCounter("commit");
      fakeEvent = await store.getCurrentReport();
    });

    it("handles success case", async function() {
      postStub.resolves(POST_SUCCESS);
      clock.tick(dayInMs);
      await store.reportStats();
      sinon.assert.calledWith(postStub, [fakeEvent]);

      // counters should be cleared in success case
      const metrics = await store.getReportsBefore(new Date(Date.now()));
      assert.deepEqual(metrics, []);
    });
    it("handles failure case", async function() {
      store.setDevMode(true);
      postStub.resolves(POST_ERROR);
      localStorage.setItem(LastDailyStatsReportKey, (Date.now() - dayInMs - 1).toString());
      clock.tick(dayInMs);
      store.setDevMode(false);
      expect(store.reportStats()).to.be.rejectedWith(ReportError);
    });
    it("does not report stats when app is in dev mode", async function() {
      store.setDevMode(true);
      await store.reportStats();
      sinon.assert.notCalled(postStub);
    });
    it("sends a single ping event instead of reporting stats if a user has opted out", async function() {
      postStub.resolves(POST_SUCCESS);
      store.setOptOut(true);
      await store.reportStats();
      await store.reportStats();
      sinon.assert.calledWith(postStub, pingEvent);

      // event should only be sent the first time even though we call report stats
      sinon.assert.callCount(postStub, 1);
    });
  });
  describe("addTimer", async function() {
    it("does not add timer in dev mode", async function() {
      store.setDevMode(true);
      await store.addTiming("load", 100);
      const stats = await store.getCurrentReport();
      assert.deepEqual(stats.timings, []);
    });
    it("does not add timer if user has opted out", async function() {
      postStub.resolves(POST_SUCCESS);
      store.setOptOut(true);
      await store.addTiming("load", 100);
      const stats = await store.getCurrentReport();
      assert.deepEqual(stats.timings, []);
    });
    it("does add timer if user has opted in and not in dev mode", async function() {
      await store.addTiming("load", 100);
      const stats = await store.getCurrentReport();
      assert.deepEqual(stats.timings.length, 1);
    });
  });
  describe("incrementCounter", async function() {
    const counterName = "commits";
    it("does not increment counter in dev mode", async function() {
      store.setDevMode(true);
      await store.incrementCounter(counterName);
      const stats = await store.getCurrentReport();
      assert.deepEqual(stats.measures, {});
    });
    it("does not increment counter if user has opted out", async function() {
      postStub.resolves(POST_SUCCESS);
      store.setOptOut(true);
      await store.incrementCounter(counterName);
      const stats = await store.getCurrentReport();
      assert.deepEqual(stats.measures, {});
    });
    it("does increment counter if non dev and user has opted in", async function() {
      await store.incrementCounter(counterName);
      const stats = await store.getCurrentReport();
      assert.deepEqual(stats.measures, { commits: 1 });
    });
  });
  describe("post", async function() {
    let fetchStub: sinon.SinonStub;
    beforeEach(async function() {
      fetchStub = sinon.stub(store, "fetch");
      fetchStub.resolves(POST_SUCCESS);
      (store.post as any).restore();
    });
    afterEach(function() {
      (store.fetch as any).restore();
    });

    it("sends the auth header if one exists", async function() {
      accessTokenFunc = getFilledAccessToken;
      await store.incrementCounter("commit");
      clock.tick(dayInMs);
      await store.reportStats();
      assert.deepEqual(fetchStub.args[0][0].headers, {
        "Content-Type": "application/json",
        Authorization: `token ${ACCESS_TOKEN}`,
      });
    });
    it("does not send the auth header if the auth header is falsy", async function() {
      accessTokenFunc = getEmptyAccessToken;
      await store.incrementCounter("commit");
      clock.tick(dayInMs);
      await store.reportStats();
      assert.deepEqual(fetchStub.args[0][0].headers, {
        "Content-Type": "application/json",
      });
    });
  });
  describe("setOptOut", async function() {
    it("sets the opt out preferences in local storage", async function() {
      assert.notOk(localStorage.getItem(StatsOptOutKey));
      postStub.resolves(POST_SUCCESS);
      await store.setOptOut(true);
      assert.ok(localStorage.getItem(StatsOptOutKey));
    });
    it("does not send ping in dev mode", async function() {
      postStub.resolves(POST_SUCCESS);
      store.setDevMode(true);
      await store.setOptOut(true);
      sinon.assert.notCalled(postStub);
    });
    it("sends one status ping when status is changed", async function() {
      const sendPingStub = sinon.stub(store, "sendOptInStatusPing").resolves(true);
      await store.setOptOut(true);
      sinon.assert.calledWith(sendPingStub, false);

      sendPingStub.reset();
      await store.setOptOut(true);
      sinon.assert.notCalled(sendPingStub);

      await store.setOptOut(false);
      sinon.assert.calledWith(sendPingStub, true);
    });
  });
  describe("hasReportingIntervalElapsed", function() {
    it("returns false if not enough time has elapsed since last report", async function() {
      localStorage.setItem(LastDailyStatsReportKey, (Date.now() - dayInMs + 100).toString());
      assert.isFalse(await (store as any).hasReportingIntervalElapsed());
    });
    it("returns true if enough time has elapsed since last report", async function() {
      localStorage.setItem(LastDailyStatsReportKey, (Date.now() - dayInMs).toString());
      assert.isTrue(await (store as any).hasReportingIntervalElapsed());
    });
  });
  describe("sendOptInStatusPing", async function() {
    it("handles success", async function() {
      postStub.resolves(POST_SUCCESS);
      await store.sendOptInStatusPing(false);
      sinon.assert.calledWith(postStub, pingEvent);

      assert.strictEqual(localStorage.getItem(HasSentOptInPingKey), "1");
    });
    it("handles error", async function() {
      postStub.resolves(POST_ERROR);
      expect(store.sendOptInStatusPing(false)).to.be.rejectedWith(PingError);

      assert.strictEqual(localStorage.getItem(HasSentOptInPingKey), null);
    });
  });
  describe("getDailyStats", async function() {
    it("event has all the fields we expect", async function() {
      const gitHubUser = "annthurium";
      store.setGitHubUser(gitHubUser);

      const counter1 = "commits";
      const counter2 = "openGitPane";
      await store.incrementCounter(counter1);
      await store.incrementCounter(counter2);
      await store.incrementCounter(counter2);

      await store.addCustomEvent(openEventType, { grammar });
      await store.addCustomEvent(deprecateEventType, { message });

      const timingEventName = "load";
      const loadTimeInMs1 = 100;
      const loadTimeInMs2 = 200;
      const metadata = { meta: "data" };
      await store.addTiming(timingEventName, loadTimeInMs1, metadata);
      await store.addTiming(timingEventName, loadTimeInMs2, metadata);

      const actual = await store.getCurrentReport();
      const expected = createReport();
      expected.dimensions.gitHubUser = gitHubUser;
      expected.customEvents.push(getOpenEvent());
      expected.customEvents.push(getDeprecateEvent());
      expected.timings.push(getTiming(timingEventName, loadTimeInMs1, metadata));
      expected.timings.push(getTiming(timingEventName, loadTimeInMs2, metadata));
      expected.measures[counter1] = 1;
      expected.measures[counter2] = 2;
      assert.deepEqual(actual, expected);
    });
    it("handles null gitHubUser", async function() {
      const event = await store.getCurrentReport();
      expect(event.dimensions.gitHubUser).to.be.undefined;
    });
  });
});
