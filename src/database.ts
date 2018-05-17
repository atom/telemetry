import * as loki from "lokijs";

const db =  new loki("stats-measures");

const measuresDb = db.addCollection("measures");

export default measuresDb;
