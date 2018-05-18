[![Build Status](https://travis-ci.com/atom/telemetry.svg?token=RwrCnzpsZN5oEq5S5p7V&branch=master)](https://travis-ci.com/atom/telemetry)

Sends usage metrics to GitHub's internal analytics pipeline.

This app can be used from any GitHub client application that speaks JavaScript and has access to localStorage.

to run tests:
`npm test`

to run lint:
`npm run-script lint`

to make the typescript go:
`tsc`

The client api is experimental and subject to change.
but for right now it looks something like this:
```
npm install telemetry-github

import StatsStore from "telemetry-github";
const store = new StatsStore("atom", "1.24.1");
```
