import * as loki from "lokijs";

const db =  new loki("stats-measures");

const measuresDb = db.addCollection("measures");

measuresDb.insert({name: "bar", count: 50});

export default measuresDb;
