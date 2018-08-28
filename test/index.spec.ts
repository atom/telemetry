import { expect, assert } from "chai";
import { AppName, DailyStatsReportIntervalInMs, HasSentOptInPingKey,
  LastDailyStatsReportKey, ReportingLoopIntervalInMs, StatsOptOutKey, StatsStore } from "../src/index";
import * as sinon from "sinon";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { IMetrics } from "telemetry-github";
import { reporters } from "mocha";
import { ReportError, PingError } from "../src/errors";

chai.use(chaiAsPromised);

const getDate = () => {
  return "2018-05-16T21:54:24.500Z";
};

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

describe("StatsStore", function() {
  const version = "1.2.3";
  let store: StatsStore;
  let postStub: sinon.SinonStub;
  let shouldReportStub: sinon.SinonStub;
  const pingEvent = { eventType: "ping", dimensions: {optIn: false} };
  let accessTokenFunc: () => string = () => "";
  const getAccessToken: () => string = () => accessTokenFunc();

  beforeEach(function() {
    accessTokenFunc = getFilledAccessToken;
    store = new StatsStore(AppName.Atom, version, getAccessToken);
    postStub = sinon.stub(store, "post");
    postStub.resolves(POST_STUB);
  });
  afterEach(async function() {
    try {
      (store.post as any).restore();
    } catch {
      // don't care
    }
    localStorage.clear();
    await store.shutdown();
  });
  describe("constructor", function() {
    let clock: sinon.SinonFakeTimers;
    beforeEach(function() {
      clock = sinon.useFakeTimers();
      postStub.resolves(POST_SUCCESS);
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
      postStub.resolves(POST_SUCCESS);
      setTimeout(() => {
        sinon.assert.notCalled(postStub);
      }, ReportingLoopIntervalInMs + 100);
    });
  });
  describe("reportStats", async function() {
    let fakeEvent: IMetrics;
    beforeEach(async function() {
      postStub.resolves(POST_SUCCESS);
      await store.incrementCounter("commit");
      fakeEvent = await store.getDailyStats(getDate);
    });
    it("handles success case", async function() {
      postStub.resolves(POST_SUCCESS);
      await store.reportStats(getDate);
      sinon.assert.calledWith(postStub, fakeEvent);

      // counters should be cleared in success case
      const counters = (await store.getDailyStats(getDate)).measures;
      assert.deepEqual(counters, {});
    });
    it("handles failure case", async function() {
      postStub.resolves(POST_ERROR);
      expect(store.reportStats(getDate)).to.be.rejectedWith(ReportError);

      // counters should not be cleared if we fail to send daily stats
      const counters = (await store.getDailyStats(getDate)).measures;
      assert.deepEqual(counters, fakeEvent.measures);
    });
    it("does not report stats when app is in dev mode", async function() {
      store.setDevMode(true);
      await store.reportStats(getDate);
      sinon.assert.notCalled(postStub);
    });
    it("sends a single ping event instead of reporting stats if a user has opted out", async function() {
      postStub.resolves(POST_SUCCESS);
      store.setOptOut(true);
      await store.reportStats(getDate);
      await store.reportStats(getDate);
      sinon.assert.calledWith(postStub, pingEvent);

      // event should only be sent the first time even though we call report stats
      sinon.assert.callCount(postStub, 1);
    });
  });
  describe("addTimer", async function() {
    it("does not add timer in dev mode", async function() {
      store.setDevMode(true);
      await store.addTiming("load", 100);
      const stats = await store.getDailyStats(getDate);
      assert.deepEqual(stats.timings, []);
    });
    it("does not add timer if user has opted out", async function() {
      postStub.resolves(POST_SUCCESS);
      store.setOptOut(true);
      await store.addTiming("load", 100);
      const stats = await store.getDailyStats(getDate);
      assert.deepEqual(stats.timings, []);
    });
    it("does add timer if user has opted in and not in dev mode", async function() {
      await store.addTiming("load", 100);
      const stats = await store.getDailyStats(getDate);
      assert.deepEqual(stats.timings.length, 1);
    });
  });
  describe("incrementCounter", async function() {
    const counterName = "commits";
    it("does not increment counter in dev mode", async function() {
      store.setDevMode(true);
      await store.incrementCounter(counterName);
      const stats = await store.getDailyStats(getDate);
      assert.deepEqual(stats.measures, {});
    });
    it("does not increment counter if user has opted out", async function() {
      postStub.resolves(POST_SUCCESS);
      store.setOptOut(true);
      await store.incrementCounter(counterName);
      const stats = await store.getDailyStats(getDate);
      assert.deepEqual(stats.measures, {});
    });
    it("does increment counter if non dev and user has opted in", async function() {
      await store.incrementCounter(counterName);
      const stats = await store.getDailyStats(getDate);
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
      await store.reportStats(getDate);
      assert.deepEqual(fetchStub.args[0][0].headers, {
        "Content-Type": "application/json",
        "Authorization": `token ${ACCESS_TOKEN}`,
      });
    });
    it("does not send the auth header if the auth header is falsy", async function() {
      accessTokenFunc = getEmptyAccessToken;
      await store.reportStats(getDate);
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
      localStorage.setItem(LastDailyStatsReportKey, (Date.now()).toString());
      assert.isFalse(await store.hasReportingIntervalElapsed());
    });
    it("returns true if enough time has elapsed since last report", async function() {
      localStorage.setItem(LastDailyStatsReportKey, (Date.now() - DailyStatsReportIntervalInMs - 1).toString());
      assert.isTrue(await store.hasReportingIntervalElapsed());
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

      await store.addCustomEvent("open", { grammar: "javascript" });
      await store.addCustomEvent("deprecate", { message: "oh noes" });

      const timingEventName = "load";
      const loadTimeInMs1 = 100;
      const loadTimeInMs2 = 200;
      const metadata = { meta: "data"};
      await store.addTiming(timingEventName, loadTimeInMs1, metadata);
      await store.addTiming(timingEventName, loadTimeInMs2, metadata);

      const event = await store.getDailyStats(getDate);

      const dimensions = event.dimensions;
      expect(dimensions.appVersion).to.eq(version);
      expect(dimensions.platform).to.eq(process.platform);
      expect(dimensions.date).to.eq(getDate());
      expect(dimensions.eventType).to.eq("usage");
      expect(dimensions.guid).to.eq((store as any).guid);
      expect(dimensions.language).to.eq(process.env.LANG);
      expect(dimensions.gitHubUser).to.eq(gitHubUser);

      const counters = event.measures;
      assert.deepEqual(counters, { [counter1]: 1,  [counter2]: 2 });

      const customEvents = event.customEvents;
      expect(customEvents.length).to.eq(2);

      const timings = event.timings;
      expect(timings.length).to.eq(2);
    });
    it("handles null gitHubUser", async function() {
      const event = await store.getDailyStats(getDate);
      expect(event.dimensions.gitHubUser).to.be.undefined;
    });
  });
});
