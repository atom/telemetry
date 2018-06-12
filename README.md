[![Build Status](https://travis-ci.com/atom/telemetry.svg?token=RwrCnzpsZN5oEq5S5p7V&branch=master)](https://travis-ci.com/atom/telemetry)

`telemetry-github` is an open source module written in TypeScript. It sends usage metrics to GitHub's internal analytics pipeline.

This app can be used from any GitHub client application that speaks JavaScript and has access to localStorage.

## License


[MIT](https://github.com/atom/telemetry/blob/master/LICENSE)

When using any GitHub logos, be sure to follow the [GitHub logo guidelines](https://github.com/logos).

## Getting started

to install package and dependencies:
`npm install telemetry-github`

to run tests:
`npm test`

to run lint:
`npm run-script lint`

to compile typescript:
`tsc`

The client api is experimental and subject to change.
but for right now it looks something like this:
```
import StatsStore from "telemetry-github";

// make a store
const store = new StatsStore("atom", "1.24.1", false, getAccessToken);

// record a usage event
store.incrementMeasure("commit");

// record a change in user consent to record metrics
store.setOptOut(true);

```

Please note that there are several methods of the `StatsStore` class that are public for unit testing purposes only.  The methods describe above are the ones that clients should care about.

### Measures vs. custom events

There are some event types that are common across all client apps. usage events, ping events, and opt in / out events. `telemetry` encapsulates as much complexity around these as possible so clients don't have to deal with it.

Measures are a great fit for understanding the number of times a certain action happened.  For example, how many times per day do users click a particular button?

However, apps might want to collect more complex metrics with arbitrary metadata. For example, Atom currently collects "file open" events, which preserve the grammar (e.g. language) of the opened file.  For those use cases, the `addCustomEvent` function is your friend.  `addCustomEvent` takes any object and stuffs it in the database, giving clients the flexibility to define their own data destiny.  The events are sent to the metrics back end along with the daily payload.

```
const event = { type: "open", grammar: "javascript", timestamp: "now" };
await measuresDb.addCustomEvent(event);
```
