import { expect } from "chai";
import { AppName, StatsStore } from "../src/index";
import * as sinon from 'sinon';

describe("StatsStore", () => {

    describe("ReportStats", () => {
        let store: StatsStore;
        beforeEach( () => {
            store = new StatsStore(AppName.Atom);
        });

        it("Handle success case", () => {
            store.post = sinon.stub();
            store.reportStats();
        });

        it("Handle failure case case", () => {
            store.post = sinon.stub();
            store.reportStats();
        });
    })
});