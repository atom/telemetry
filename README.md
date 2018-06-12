[![Build Status](https://travis-ci.com/atom/telemetry.svg?token=RwrCnzpsZN5oEq5S5p7V&branch=master)](https://travis-ci.com/atom/telemetry)

`github-telemetry` is an open source module written in TypeScript. It sends usage metrics to GitHub's internal analytics pipeline.

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
