import { expect, assert } from "chai";
import { AppName, StatsStore } from "../src/index";
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
    const store = new StatsStore(AppName.Atom, version);
    describe("reportStats", async function() {
        const fakeEvent = await store.getDailyStats(getDate);
        it("handles success case", async function() {
            const postStub = sinon.stub(store, "post").resolves({status: 200});
            await store.reportStats(getDate);
            sinon.assert.calledWith(postStub, fakeEvent);
            postStub.restore();
        });
        it("handles failure case", async function() {
            const postStub = sinon.stub(store, "post").resolves({status: 500});
            await store.reportStats(getDate);
            sinon.assert.calledWith(postStub, fakeEvent);
            postStub.restore();
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
            // restore state of store to avoid the test leaking state, even though it doesn't matter right now
            store.setOptOut(false);
            postStub.restore();
        });
    });
    describe("getDailyStats", function() {
        it("event has all the fields we expect", async function() {
            const event = await store.getDailyStats(getDate);
            const dimensions = event.dimensions;
            expect(dimensions.accessToken).to.be.null;
            expect(dimensions.version).to.eq(version);
            expect(dimensions.platform).to.eq(process.platform);
            expect(dimensions.date).to.eq(getDate());
            expect(dimensions.eventType).to.eq("usage");
            expect(dimensions.guid).to.eq(getGUID());
        });
    });
});
