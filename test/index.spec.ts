import { expect, assert } from "chai";
import { AppName, StatsOptOutKey, StatsStore } from "../src/index";
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
    beforeEach(async function() {
        store = new StatsStore(AppName.Atom, version);
    });
    describe("reportStats", async function() {
        const fakeEvent = await store.getDailyStats(getDate);
        it("handles success case", async function() {
            const postStub = sinon.stub(store, "post").resolves({status: 200});
            await store.reportStats(getDate);
            sinon.assert.calledWith(postStub, fakeEvent);
            postStub.restore();
            // test that daily stats were cleared in success case
        });
        it("handles failure case", async function() {
            const postStub = sinon.stub(store, "post").resolves({status: 500});
            await store.reportStats(getDate);
            sinon.assert.calledWith(postStub, fakeEvent);
            postStub.restore();
            // test that daily stats were not cleared in the failure case
        });
        it("sends a single ping event instead of reporting stats if a user has opted out", async function() {
            const pingEvent = { eventType: "ping", optIn: false };
            const postStub = sinon.stub(store, "post").resolves({status: 200});
            store.setOptOut(true);
            await store.reportStats(getDate);
            await store.reportStats(getDate);
            sinon.assert.calledWith(postStub, pingEvent);

            // event should only be sent the first time even though we call report stats
            sinon.assert.callCount(postStub, 1);

            postStub.restore();
        });
    });
    describe("setOptOut", async function() {
        it("sets the opt out preferences in local storage", async function() {

            store.setOptOut(true);
        });
        it("sends the status ping when status is changed", async function() {
            // can mock sendOptInStatusPing
        });
    });
    describe("sendOptInStatusPing", async function() {
        console.log("foo");
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
