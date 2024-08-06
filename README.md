# textlint-rule-no-dead-link

[![textlint rule](https://img.shields.io/badge/textlint-fixable-green.svg?style=social)](https://textlint.github.io/)
[![npm](https://img.shields.io/npm/v/textlint-rule-no-dead-link.svg)](https://www.npmjs.com/package/textlint-rule-no-dead-link)
[![test](https://github.com/textlint-rule/textlint-rule-no-dead-link/actions/workflows/test.yml/badge.svg)](https://github.com/textlint-rule/textlint-rule-no-dead-link/actions/workflows/test.yml)

[textlint](https://github.com/textlint/textlint) rule
to make sure every link in a document is available.

The primary target of this rule is Markdown documents, but it also works on plain text documents (See tests).

## Installation

```shell
npm install textlint-rule-no-dead-link
```

## Usage

```shell
npm install textlint textlint-rule-no-dead-link
textlint --rule textlint-rule-no-dead-link text-to-check.txt
```

## Features

### Dead Link Detection

Shows an error if a link is dead (i.e. its server returns one of the ["non-ok" responses](https://fetch.spec.whatwg.org/#ok-status)).

### Obsolete Link Detection

[![Fixable](https://img.shields.io/badge/textlint-fixable-green.svg?style=social)](https://textlint.github.io/)

Shows an error if a link is obsolete or moved to another location (i.e. its server returns one of the ["redirect" responses](https://fetch.spec.whatwg.org/#redirect-status)).

This error is fixable and textlint will automatically replace the obsolete links with their new ones if you run it with `--fix` option.

### Relative Link Resolution

Sometimes your files contain relative URIs, which don't have domain information in an URI string.
In this case, we have to somehow resolve the relative URIs and convert them into absolute URIs.

The resolution strategy is as follows:

1. If `baseURI` is specified, use that path to resolve relative URIs (See the below section for details).
2. If not, try to get the path of the file being linted and use its parent folder as the base path.
3. If that's not available (e.g., when you are performing linting from API), put an error `Unable to resolve the relative URI`.

## Options

Please write your configurations in `.textlintrc`.

The default options are:

```json
{
  "rules": {
    "no-dead-link": {
      "checkRelative": true,
      "baseURI": null,
      "ignore": [],
      "dotInIgnore": false,
      "ignoreRedirects": false,
      "preferGET": [],
      "retry": 3,
      "userAgent": "textlint-rule-no-dead-link/1.0",
      "maxRetryTime": 10,
      "maxRetryAfterTime": 90
    }
  }
}
```

### checkRelative

This rule checks the availability of relative URIs by default.
You can turn off the checks by passing `false` to this option.

### baseURI

The base URI to be used for resolving relative URIs.

Though its name, you can pass either an URI starting with `http` or `https`, or an file path starting with `/`.

Examples:

```json
"no-dead-link": {
  "baseURI": "http://example.com/"
}
```

```json
"no-dead-link": {
  "baseURI": "/Users/textlint/path/to/parent/folder/"
}
```

### ignore

An array of URIs or [glob](https://github.com/isaacs/node-glob "glob")s to be ignored.
These list will be skipped from the availability checks.

Example:

```json
"no-dead-link": {
  "ignore": [
    "http://example.com/not-exist/index.html",
    "http://example.com/*" // glob format
  ]
}
```

### dotInIgnore

This rule allows ignore patterns to match filenames starting with a period.
For example, if the `ignore` option contains `"http://example.com/**"` and the `dotInIgnore` option is set to `true`, paths containing filenames that start with `.` (like `"http://example.com/.hidden/index.html"`) will be ignored.
You can disable this behavior by setting `dotInIgnore` to `false`.

_cf_, <https://github.com/isaacs/minimatch?tab=readme-ov-file#dot>

### preferGET

An array of [origins](https://url.spec.whatwg.org/#origin) to lets the rule connect to the origin's URL by `GET` instead of default `HEAD` request.

Although the rule will fall back to `GET` method when `HEAD` request is failed (status code is not between 200 and 300), in order to shorten time to run your test, you can use this option when you are sure that target origin always returns 5xx for `HEAD` request.

Example:

```json
"no-dead-link": {
  "preferGET": [
    "http://example.com"
  ]
}
```

### ignoreRedirects

This rule checks for redirects (3xx status codes) and consider's them an error by default.
To ignore redirects during checks, set this value to `false`.

<!-- Experimental

### concurrency

This rule checks links concurrently.
The default concurrency count is `8`.

-->
### retry

This rule checks the url with retry.
The default max retry count is `3`.

### userAgent

Customize `User-Agent` http header.

### maxRetryTime

The max of waiting seconds for retry. It is related to `retry` option.

:memo: It does affect to [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) header. If you want to max waiting seconds for `Retry-After` header, please use `maxRetryAfterTime` option.

Default: `10`

### maxRetryAfterTime

The max of allow waiting time second for [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) header value.

Some website like GitHub returns `Retry-After` header value with `429 too many requests`.
This `maxRetryAfterTime` option is for that `Retry-After`.

Default: `10`

## CI Integration

Probably, Link Checking take long times.
We recommend to use cron job like GitHub Actions.

### textlint + [SARIF output](https://www.npmjs.com/package/@microsoft/eslint-formatter-sarif) + [code scanning](https://docs.github.com/en/code-security/code-scanning/automatically-scanning-your-code-for-vulnerabilities-and-errors/about-code-scanning)

Preparing:

```shell
# Install dependencies
npm install --save-dev textlint @microsoft/eslint-formatter-sarif textlint-rule-no-dead-link
# Create .textlintrc
npx textlint --init
```

Following actions check links and upload the status to [code scanning](https://docs.github.com/en/code-security/code-scanning/automatically-scanning-your-code-for-vulnerabilities-and-errors/about-code-scanning).

You can see the result at `https://github.com/{owner}/{repo}/security/code-scanning`.

```yaml
name: Link Check
on:
  workflow_dispatch:
  schedule:
    - cron: '45 15 * * *'

permissions:
  contents: read
  security-events: write

jobs:
  test:
    runs-on: ubuntu-latest
    name: Link Check
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npx textlint -f @microsoft/eslint-formatter-sarif -o textlint.sarif || exit 0 # workaround https://github.com/textlint/textlint/issues/103
      - name: Upload SARIF file
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: textlint.sarif
          category: textlint
```

## Tests

```shell
npm test
```

## Contribution

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## License

MIT License (<http://nodaguti.mit-license.org/>)
