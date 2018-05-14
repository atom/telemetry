import { expect, assert } from "chai";
import { AppName, StatsStore } from "../src/index";
import { LocalStorageWorker } from "../src/storage-helper";
import * as sinon from 'sinon';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

describe("StatsStore", () => {
    const store = new StatsStore(AppName.Atom);
    describe("ReportStats", () => {
        const fakeEvent = { foo: 'bazz' };

        it("Handle success case", async () => {
            const stub = sinon.stub(store, 'post').resolves('ok');
            await store.reportStats();
            sinon.assert.calledWith(stub, fakeEvent);
            stub.restore();
        });

        it("Handle failure case", async () => {
            const stub = sinon.stub(store, 'post').rejects('not ok');
            expect(async () => await store.reportStats()).to.be.rejectedWith;
            stub.restore();
        });
    })
});