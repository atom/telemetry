import { expect, assert } from "chai";
import { AppName, DailyStatsReportIntervalInMs, HasSentOptInPingKey,
  LastDailyStatsReportKey, Metrics, StatsOptOutKey, StatsStore } from "../src/index";
import * as sinon from "sinon";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { getGUID } from "../src/uuid";

const ReportingLoopIntervalInMs = DailyStatsReportIntervalInMs / 6;

chai.use(chaiAsPromised);

const ACCESS_TOKEN = "SUPER_AWESOME_ACCESS_TOKEN";

const getAccessToken = () => {
  return ACCESS_TOKEN;
};

describe("StatsStore", function() {
  const version = "1.2.3";
  let store: StatsStore;
  let postStub: sinon.SinonStub;
  let shouldReportStub: sinon.SinonStub;
  const pingEvent = { eventType: "ping", dimensions: {optIn: false} };

  beforeEach(function() {
    store = new StatsStore(AppName.Atom, version, false, getAccessToken);
    postStub = sinon.stub(store, "post");
  });
  afterEach(async function() {
    store.end();
    localStorage.clear();
    await store.clearData();
  });
  describe("constructor", function() {
    let clock: sinon.SinonFakeTimers;
    beforeEach(function() {
      clock = sinon.useFakeTimers();
      postStub.resolves({ status: 200 });
    });
    afterEach(function() {
      clock.restore();
    });
    it("reports stats when hasReportingIntervalElapsed returns true", function() {
      shouldReportStub = sinon.stub(store, "hasReportingIntervalElapsed").callsFake(() => true);
      setTimeout(() => {
        sinon.assert.called(postStub);
      }, ReportingLoopIntervalInMs + 100);
    });
    it("does not report stats when shouldReportDailyStats returns false", function() {
      shouldReportStub = sinon.stub(store, "hasReportingIntervalElapsed").callsFake(() => false);
      postStub.resolves({ status: 200 });
      setTimeout(() => {
        sinon.assert.notCalled(postStub);
      }, ReportingLoopIntervalInMs + 100);
    });
  });
  describe("reportStats", async function() {
    let fakeEvent: Metrics;

    beforeEach(async function() {
      await store.incrementCounter("commit");
      fakeEvent = await store.getDailyStats();
    });

    it("handles success case", async function() {
      postStub.resolves({ status: 200 });
      await store.reportStats();
      const event: Metrics = postStub.getCalls()[0].args[0];

      // Remove the date from both events since it can be different.
      fakeEvent.dimensions = {...fakeEvent.dimensions, date: "mock"};
      event.dimensions = {...event.dimensions, date: "mock"};

      assert.deepEqual(event, fakeEvent);

      // counters should be cleared in success case
      const counters = (await store.getDailyStats()).measures;
      assert.deepEqual(counters, {});
    });
    it("handles failure case", async function() {
      postStub.resolves({ status: 500 });
      await store.reportStats();

      const event: Metrics = postStub.getCalls()[0].args[0];

      // Remove the date from both events since it can be different.
      fakeEvent.dimensions = {...fakeEvent.dimensions, date: "mock"};
      event.dimensions = {...event.dimensions, date: "mock"};

      assert.deepEqual(event, fakeEvent);

      // counters should not be cleared if we fail to send daily stats
      const counters = (await store.getDailyStats()).measures;
      assert.deepEqual(counters, fakeEvent.measures);
    });
    it("does not report stats when app is in dev mode", async function() {
      const storeInDevMode = new StatsStore(AppName.Atom, version, true, getAccessToken);
      postStub = sinon.stub(storeInDevMode, "post").resolves( { status: 200 });
      await storeInDevMode.reportStats();
      sinon.assert.notCalled(postStub);

      storeInDevMode.end();
    });
    it("sends a single ping event instead of reporting stats if a user has opted out", async function() {
      postStub.resolves({ status: 200 });
      store.setOptOut(true);
      await store.reportStats();
      await store.reportStats();
      sinon.assert.calledWith(postStub, pingEvent);

      // event should only be sent the first time even though we call report stats
      sinon.assert.callCount(postStub, 1);
    });

    it("does not report stats twice when called concurrently", async function() {
      const store1 = new StatsStore(AppName.Atom, version, false, getAccessToken);
      const store2 = new StatsStore(AppName.Atom, version, false, getAccessToken);

      const stubFetch = sinon.stub(window, "fetch");
      stubFetch.returns(Promise.resolve(new Response(new ReadableStream(), {
        status: 200,
        headers: { "Content-type": "application/json" },
      })));

      await Promise.all([
        store1.reportStats(),
        store2.reportStats(),
      ]);
      sinon.assert.calledOnce(stubFetch);

      store1.end();
      store2.end();
    });
  });
  describe("addTimer", async function() {
    it("does not add timer in dev mode", async function() {
      const storeInDevMode = new StatsStore(AppName.Atom, version, true, getAccessToken);
      await storeInDevMode.addTiming("load", 100);
      const stats = await storeInDevMode.getDailyStats();
      assert.deepEqual(stats.timings, []);

      storeInDevMode.end();
    });
    it("does not add timer if user has opted out", async function() {
      store.setOptOut(true);
      await store.addTiming("load", 100);
      const stats = await store.getDailyStats();
      assert.deepEqual(stats.timings, []);
    });
    it("does add timer if user has opted in and not in dev mode", async function() {
      await store.addTiming("load", 100);
      const stats = await store.getDailyStats();
      assert.deepEqual(stats.timings.length, 1);
    });
  });
  describe("incrementCounter", async function() {
    const counterName = "commits";
    it("does not increment counter in dev mode", async function() {
      const storeInDevMode = new StatsStore(AppName.Atom, version, true, getAccessToken);
      await storeInDevMode.incrementCounter(counterName);
      const stats = await storeInDevMode.getDailyStats();
      assert.deepEqual(stats.measures, {});

      storeInDevMode.end();
    });
    it("does not increment counter if user has opted out", async function() {
      store.setOptOut(true);
      await store.incrementCounter(counterName);
      const stats = await store.getDailyStats();
      assert.deepEqual(stats.measures, {});
    });
    it("does increment counter if non dev and user has opted in", async function() {
      await store.incrementCounter(counterName);
      const stats = await store.getDailyStats();
      assert.deepEqual(stats.measures, {[counterName]: 1});
    });
  });
  describe("post", async function() {
    it("sends the auth header if one exists", async function() {
      const storeWithToken = new StatsStore(AppName.Atom, version, false, getAccessToken);
      const fetch: sinon.SinonStub = sinon.stub(storeWithToken, "fetch").resolves({ status: 200 });
      await storeWithToken.reportStats();
      assert.deepEqual(fetch.args[0][1].headers, {
        "Content-Type": "application/json",
        "Authorization": `token ${ACCESS_TOKEN}`,
      });

      storeWithToken.end();
    });
    it("does not send the auth header if the auth header is falsy", async function() {
      const storeWithFalseHeader = new StatsStore(AppName.Atom, version, false, () => "");
      const fetch: sinon.SinonStub = sinon.stub(storeWithFalseHeader, "fetch").resolves({ status: 200 });
      await storeWithFalseHeader.reportStats();
      assert.deepEqual(fetch.args[0][1].headers, {
        "Content-Type": "application/json",
      });

      storeWithFalseHeader.end();
    });
    it("logs a message in the console when in verbose mode", async function() {
      const consoleLogStub = sinon.stub(console, "log");

      const storeVerbose = new StatsStore(AppName.Atom, version, false, getAccessToken, {verboseMode: true});
      const fetch: sinon.SinonStub = sinon.stub(storeVerbose, "fetch").resolves({ status: 200 });
      await storeVerbose.reportStats();
      assert.deepEqual(fetch.args[0][1].headers, {
        "Content-Type": "application/json",
        "Authorization": `token ${ACCESS_TOKEN}`,
      });
      sinon.assert.calledWith(consoleLogStub, "Sending metrics");
      consoleLogStub.restore();

      storeVerbose.end();
    });
    it("logs a message in the console when in dev mode and dev logging is enabled", async function() {
      const consoleLogStub = sinon.stub(console, "log");

      const storeLogging = new StatsStore(AppName.Atom, version, true, getAccessToken, {logInDevMode: true});
      const fetch: sinon.SinonStub = sinon.stub(storeLogging, "fetch").resolves({ status: 200 });
      await storeLogging.reportStats();
      assert.deepEqual(fetch.args[0][1].headers, {
        "Content-Type": "application/json",
        "Authorization": `token ${ACCESS_TOKEN}`,
      });
      sinon.assert.calledWith(consoleLogStub, "Sending metrics");
      consoleLogStub.restore();
      storeLogging.end();
    });
  });
  describe("setOptOut", async function() {
    it("sets the opt out preferences in local storage", async function() {
      assert.notOk(localStorage.getItem(StatsOptOutKey));
      await store.setOptOut(true);
      assert.ok(localStorage.getItem(StatsOptOutKey));
    });
    it("does not send ping in dev mode", async function() {
      const storeInDevMode = new StatsStore(AppName.Atom, version, true, getAccessToken);
      await storeInDevMode.setOptOut(true);
      sinon.assert.notCalled(postStub);

      storeInDevMode.end();
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
    it("returns false if not enough time has elapsed since last report", function() {
      localStorage.setItem(LastDailyStatsReportKey, (Date.now()).toString());
      assert.isFalse(store.hasReportingIntervalElapsed());
    });
    it("returns true if enough time has elapsed since last report", function() {
      localStorage.setItem(LastDailyStatsReportKey, (Date.now() - DailyStatsReportIntervalInMs - 1).toString());
      assert.isTrue(store.hasReportingIntervalElapsed());
    });

    it("returns true if enough time has elapsed since last report for a custom interval", function() {
      const reportingFrequency = 100;
      const storeWithFrequency = new StatsStore(AppName.Atom, version, false, getAccessToken, {reportingFrequency});

      localStorage.setItem(LastDailyStatsReportKey, (Date.now() - reportingFrequency + 1).toString());
      assert.isFalse(storeWithFrequency.hasReportingIntervalElapsed());

      localStorage.setItem(LastDailyStatsReportKey, (Date.now() - reportingFrequency - 1).toString());
      assert.isTrue(storeWithFrequency.hasReportingIntervalElapsed());

      storeWithFrequency.end();
    });
  });
  describe("sendOptInStatusPing", async function() {
    it("handles success", async function() {
      postStub.resolves({status: 200});
      await store.sendOptInStatusPing(false);

      sinon.assert.calledWith(postStub, pingEvent);

      assert.strictEqual(localStorage.getItem(HasSentOptInPingKey), "1");
    });
    it("handles error", async function() {
      postStub.resolves({ status: 500 });
      await store.sendOptInStatusPing(false);

      sinon.assert.calledWith(postStub, pingEvent);

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

      await store.addCustomEvent("open", { grammar: "javascript" });
      await store.addCustomEvent("deprecate", { message: "oh noes" });

      const timingEventName = "load";
      const loadTimeInMs1 = 100;
      const loadTimeInMs2 = 200;
      const metadata = { meta: "data"};
      await store.addTiming(timingEventName, loadTimeInMs1, metadata);
      await store.addTiming(timingEventName, loadTimeInMs2, metadata);

      const event = await store.getDailyStats();

      const dimensions = event.dimensions;
      expect(dimensions.appVersion).to.eq(version);
      expect(dimensions.platform).to.eq(process.platform);
      expect(dimensions.eventType).to.eq("usage");
      expect(dimensions.guid).to.eq(getGUID());
      expect(dimensions.language).to.eq(process.env.LANG);
      expect(dimensions.gitHubUser).to.eq(gitHubUser);

      const counters = event.measures;
      expect(counters).to.deep.include({ [counter1]: 1});
      expect(counters).to.deep.include({ [counter2]: 2});

      const customEvents = event.customEvents;
      expect(customEvents.length).to.eq(2);

      const timings = event.timings;
      expect(timings.length).to.eq(2);
    });
    it("handles null gitHubUser", async function() {
      const event = await store.getDailyStats();
      expect(event.dimensions.gitHubUser).to.be.null;
    });
  });
});
