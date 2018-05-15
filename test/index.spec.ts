import { expect, assert } from "chai";
import { AppName, StatsStore } from "../src/index";
import * as sinon from "sinon";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

describe("StatsStore", () => {
    const version = "1.2.3";
    const store = new StatsStore(AppName.Atom, version);
    describe("ReportStats", async () => {
        const fakeEvent = await store.getDailyStats();
        it("Handle success case", async () => {
            const stub = sinon.stub(store, "post").resolves({status: 200});
            await store.reportStats();
            sinon.assert.calledWith(stub, fakeEvent);
            stub.restore();
        });
        it("Handle failure case", async () => {
            const stub = sinon.stub(store, "post").resolves({status: 500});
            await store.reportStats();
            sinon.assert.calledWith(stub, fakeEvent);
            stub.restore();
        });
    });
    describe("GetDailyStats", () => {
        it("event has all the fields we expect", async () => {
            const event = await store.getDailyStats();
            expect(event.accessToken).to.be.null;
            expect(event.version).to.eq(version);
            expect(event.platform).to.eq(process.platform);
            expect(event.eventType).to.eq("usage");
            expect(event.guid).to.be.ok;
        });
    });
});
