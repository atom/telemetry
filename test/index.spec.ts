import { expect, assert } from "chai";
import { AppName, StatsStore } from "../src/index";
import * as sinon from "sinon";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { getGUID } from "../src/uuid";

chai.use(chaiAsPromised);

describe("StatsStore", function() {
    const version = "1.2.3";
    const store = new StatsStore(AppName.Atom, version);
    describe("ReportStats", async () => {
        const fakeEvent = await store.getDailyStats();
        it("handles success case", async function() {
            const stub = sinon.stub(store, "post").resolves({status: 200});
            await store.reportStats();
            sinon.assert.calledWith(stub, fakeEvent);
            stub.restore();
        });
        it("handles failure case", async function() {
            const stub = sinon.stub(store, "post").resolves({status: 500});
            await store.reportStats();
            sinon.assert.calledWith(stub, fakeEvent);
            stub.restore();
        });
    });
    describe("GetDailyStats", () => {
        it("event has all the fields we expect", async function() {
            const event = await store.getDailyStats();
            expect(event.accessToken).to.be.null;
            expect(event.version).to.eq(version);
            expect(event.platform).to.eq(process.platform);
            expect(event.eventType).to.eq("usage");
            expect(event.guid).to.eq(getGUID());
        });
    });
});
