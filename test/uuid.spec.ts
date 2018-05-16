import { assert } from "chai";
import { getGUID, StatsGUIDKey } from "../src/uuid";

describe("uuid", () => {
    describe("getGUID", () => {
        it("uses cached GUID if one exists already", () => {
            const GUID = getGUID();
            const GUID2 = getGUID();
            console.log(GUID);
            assert.deepEqual(GUID, GUID2);
        });
    });
});
