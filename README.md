[![Build Status](https://travis-ci.com/atom/telemetry.svg?token=RwrCnzpsZN5oEq5S5p7V&branch=master)](https://travis-ci.com/atom/telemetry)

`telemetry-github` is an open source module written in TypeScript. It sends usage metrics to GitHub's internal analytics pipeline.

This app can be used from any GitHub client application that speaks JavaScript and has access to localStorage.

We've open-sourced this library because we care about privacy and want to be transparent about how we collect metrics.

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
const store = new StatsStore("atom", "1.24.1", false, getAccessToken, options);

// record a usage event
store.incrementCounter("commit");

// record a change in user consent to record metrics
store.setOptOut(true);

```

Please note that there are several methods of the `StatsStore` class that are public for unit testing purposes only.  The methods describe below are the ones that clients should care about.

### Counters vs. custom events

There are some event types that are common across all client apps: usage events, ping events, and opt in / out events. `telemetry` encapsulates as much complexity around these as possible so clients don't have to deal with it.

Counters are a great fit for understanding the number of times a certain action happened.  For example, how many times per day do users click a particular button?

However, apps might want to collect more complex metrics with arbitrary metadata. For example, Atom currently collects "file open" events, which preserve the grammar (aka language) of the opened file.  For those use cases, the `addCustomEvent` function is your friend.  `addCustomEvent` takes any object and stuffs it in the database, giving clients the flexibility to define their own data destiny.  The events are sent to the metrics back end along with the daily payload.

Events must include a type, which is the first argument to `addCustomEvent`. A timestamp is added for you in ISO-8601 format.

```
const event = { grammar: "javascript" };
await store.addCustomEvent("open", event);

// { "date": "2018-06-14T21:01:33.602Z", "eventType": "open", "grammar": "javascript" }
```

### Timers

You can use the `addTimer` API to send latency metrics. While of course you could use `addCustomEvent` to record latency metrics, using this endpoint allows us to have a consistent event format across apps.

```
const eventType = "appStartup";
const loadTimeInMilliseconds = 42;
const metadata = {spam: "ham"};
// metadata is optional
store.addTiming(eventType, loadTimeInMilliseconds, metadata);
```

### Options

You can pass additional options to `telemetry` via its constructor:

```js
// The following are the default values
const options = {
  reportingFrequency: 86400, // How often do we want to send metrics.
  logInDevMode: false, // Whether it should send metrics when isDevMode is true.
  verboseMode: false, // Whether it should log the requests in the console.
};

const store = new StatsStore("atom", "1.24.1", false, getAccessToken, options);
```

All the option parameters are optional.

## Publishing a new release

Follow [these instructions](https://docs.npmjs.com/getting-started/publishing-npm-packages) for releasing a new version with npm. In order for client apps to use a new version, bump the version of `telemetry-github` in the `package.json` file, and then run `npm install` again.

## License


[MIT](https://github.com/atom/telemetry/blob/master/LICENSE)

When using any GitHub logos, be sure to follow the [GitHub logo guidelines](https://github.com/logos).
