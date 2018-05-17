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
            const stub = sinon.stub(store, "post").resolves({status: 200});
            await store.reportStats(getDate);
            sinon.assert.calledWith(stub, fakeEvent);
            stub.restore();
        });
        it("handles failure case", async function() {
            const stub = sinon.stub(store, "post").resolves({status: 500});
            await store.reportStats(getDate);
            sinon.assert.calledWith(stub, fakeEvent);
            stub.restore();
        });
    });
    describe("measuresDb", async function() {
        const measureName = "commits";
        beforeEach(async function() {
            await store.clearMeasures();
        });
        describe("incrementMeasure", async function() {
            it("adds a new measure if it does not exist", async function() {
                const measure = await store.getMeasure(measureName);
                assert.deepEqual(measure, {});
                await store.incrementMeasure(measureName);
                const incrementedMeasure = await store.getMeasures();
                assert.deepEqual(incrementedMeasure, {[measureName]: 1});
            });
            it("increments an existing measure", async function() {
                await store.incrementMeasure(measureName);
                const measure = await store.getMeasure(measureName);
                assert.deepEqual(measure, {[measureName]: 1});
                await store.incrementMeasure(measureName);
                const incrementedMeasure = await store.getMeasure(measureName);
                const foo = await store.getMeasure(measureName);
                assert.deepEqual(incrementedMeasure, { [measureName]: 2});
            });
        });
        describe("getMeasure", async function() {
            it("gets an empty object if measure does not exist", async function() {
                const measure = await store.getMeasure("foo");
                assert.deepEqual(measure, {});
            });
            it("gets a measure if it exists", async function() {
                await store.incrementMeasure(measureName);
                const measure = await store.getMeasure(measureName);
                assert.deepEqual(measure, { [measureName]: 1 });
            });
        });
        describe("getMeasures", async function() {
            it("gets all measures that exist", async function() {
                await store.incrementMeasure(measureName);
                await store.incrementMeasure("foo");
                const measures = await store.getMeasures();
                assert.deepEqual(measures, { [measureName]: 1, foo: 1});
            });
        });
        describe("clearMeasures", async function() {
            it("clears db containing single measure", async function() {
                await store.incrementMeasure(measureName);
                await store.clearMeasures();
                const measures = await store.getMeasures();
                assert.deepEqual(measures, {});
            });
            it("clears db containing multiple measures", async function() {
                await store.incrementMeasure(measureName);
                await store.incrementMeasure(measureName);
                await store.clearMeasures();
                const measures = await store.getMeasures();
                assert.deepEqual(measures, {});
            });
            it("clearing an empty db does not throw an error", async function() {
                const measures = await store.getMeasures();
                assert.deepEqual(measures, {});
                await store.clearMeasures();
            });
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
