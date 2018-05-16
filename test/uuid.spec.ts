import { assert } from "chai";
import { getGUID, StatsGUIDKey } from "../src/uuid";

describe("uuid", () => {
    describe("getGUID", function() {
        it("uses cached GUID if one exists already", function() {
            const GUID = getGUID();
            const GUID2 = getGUID();
            assert.deepEqual(GUID, GUID2);
        });
    });
});
