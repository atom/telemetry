import { expect, assert } from "chai";
import { AppName, StatsStore } from "../src/index";
import { LocalStorageWorker } from "../src/storage-helper";
import * as sinon from 'sinon';

describe("StatsStore", () => {
    const store = new StatsStore(AppName.Atom);
    describe("ReportStats", () => {
        const fakeEvent = { foo: 'bazz' };

        it("Handle success case", async function() {
            const stub = sinon.stub(store, 'post').resolves('ok');
            await store.reportStats();
            sinon.assert.calledWith(stub, fakeEvent);
            stub.restore();
        });

        it("Handle failure case", async () => {
            const stub = sinon.stub(store, 'post').rejects('not ok');
            await expect(async () => await store.reportStats()).to.throw();
            stub.restore();
        });
    })
});