import { expect, assert } from "chai";
import { AppName, HasSentOptInPingKey, IMetrics, StatsOptOutKey, StatsStore } from "../src/index";
import * as sinon from "sinon";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { getGUID } from "../src/uuid";

chai.use(chaiAsPromised);

const getDate = () => {
  return "2018-05-16T21:54:24.500Z";
};

describe("StatsStore", function() {
  const version = "1.2.3";
  let store: StatsStore;
  let postStub: sinon.SinonStub;
  const pingEvent = { eventType: "ping", dimensions: {optIn: false} };

  beforeEach(function() {
    store = new StatsStore(AppName.Atom, version, false);
    postStub = sinon.stub(store, "post");
  });
  afterEach(async function() {
    localStorage.clear();
  });
  describe("reportStats", async function() {
    let fakeEvent: IMetrics;
    beforeEach(async function() {
      await store.incrementMeasure("commit");
      fakeEvent = await store.getDailyStats(getDate);
    });
    it("handles success case", async function() {
      postStub.resolves({ status: 200 });
      await store.reportStats(getDate);
      sinon.assert.calledWith(postStub, fakeEvent);

      // measures should be cleared in success case
      const measures = (await store.getDailyStats(getDate)).measures;
      assert.deepEqual(measures, {});
    });
    it("handles failure case", async function() {
      postStub.resolves({ status: 500 });
      await store.reportStats(getDate);
      sinon.assert.calledWith(postStub, fakeEvent);

      // measures should not be cleared if we fail to send daily stats
      const measures = (await store.getDailyStats(getDate)).measures;
      assert.deepEqual(measures, fakeEvent.measures);
    });
    it("does not report stats when app is in dev mode", async function() {
      const storeInDevMode = new StatsStore(AppName.Atom, version, true);
      postStub = sinon.stub(storeInDevMode, "post").resolves( { status: 200 });
      await storeInDevMode.reportStats(getDate);
      sinon.assert.notCalled(postStub);
    });
    it("sends a single ping event instead of reporting stats if a user has opted out", async function() {
      postStub.resolves({ status: 200 });
      store.setOptOut(true);
      await store.reportStats(getDate);
      await store.reportStats(getDate);
      sinon.assert.calledWith(postStub, pingEvent);

      // event should only be sent the first time even though we call report stats
      sinon.assert.callCount(postStub, 1);
    });
  });
  describe("setOptOut", async function() {
    it("sets the opt out preferences in local storage", async function() {
      assert.notOk(localStorage.getItem(StatsOptOutKey));
      await store.setOptOut(true);
      assert.ok(localStorage.getItem(StatsOptOutKey));
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
      const measure1 = "commits";
      const measure2 = "openGitPane";
      await store.incrementMeasure(measure1);
      await store.incrementMeasure(measure2);
      await store.incrementMeasure(measure2);

      const event = await store.getDailyStats(getDate);

      const dimensions = event.dimensions;
      expect(dimensions.accessToken).to.be.null;
      expect(dimensions.version).to.eq(version);
      expect(dimensions.platform).to.eq(process.platform);
      expect(dimensions.date).to.eq(getDate());
      expect(dimensions.eventType).to.eq("usage");
      expect(dimensions.guid).to.eq(getGUID());

      const measures = event.measures;
      expect(measures).to.deep.include({ [measure1]: 1});
      expect(measures).to.deep.include({ [measure2]: 2});
    });
  });
});
