import * as loki from "lokijs";

const db =  new loki("stats-measures");

const measuresDb = db.addCollection("measures");

// measuresDb.insert({name: "bar", count: 50});

// const foo = measuresDb.find({name: "bar"});
// foo[0].count += 1;
// measuresDb.update(foo[0]);
// console.log("YO", measuresDb.find({name: "bar"}));

export default measuresDb;
