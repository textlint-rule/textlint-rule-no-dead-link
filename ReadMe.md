# textlint-rule-no-dead-link

[![textlint rule](https://img.shields.io/badge/textlint-fixable-green.svg?style=social)](https://textlint.github.io/)
[![npm](https://img.shields.io/npm/v/textlint-rule-no-dead-link.svg)](https://www.npmjs.com/package/textlint-rule-no-dead-link)
[![Build Status](https://travis-ci.org/textlint-rule/textlint-rule-no-dead-link.svg?branch=master)](https://travis-ci.org/textlint-rule/textlint-rule-no-dead-link)
[![Dependency Status](https://david-dm.org/textlint-rule/textlint-rule-no-dead-link.svg)](https://david-dm.org/textlint-rule/textlint-rule-no-dead-link)
[![devDependency Status](https://david-dm.org/textlint-rule/textlint-rule-no-dead-link/dev-status.svg)](https://david-dm.org/textlint-rule/textlint-rule-no-dead-link#info=devDependencies)

[textlint](https://github.com/textlint/textlint) rule
to make sure every link in a document is available.

The primary target of this rule is Markdown documents, but it also works on plain text documents (See tests).

## Installation

```
$ npm install textlint-rule-no-dead-link
```

## Usage

```
$ npm install textlint textlint-rule-no-dead-link
$ textlint --rule textlint-rule-no-dead-link text-to-check.txt
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

You can enable availability checks to such links by telling the rule how to resolve the relative links (See below for details).

## Options

Please write your configurations in `.textlintrc`.

The default options are:

```
{
  "rules": {
    "no-dead-link": {
      "checkRelative": false,
      "baseURI": null,
      "ignore": [],
    }
  }
}
```

### checkRelative

Enable the dead link checks against relative URIs.
Note that you also have to specify the `baseURI` to make this option work.

### baseURI

The base URI to be used for resolving relative URIs.

Example:

```
{
  "rules": {
    "no-dead-link": {
      "checkRelative": true,
      "baseURI": "http://example.com/"
    }
  }
}
```

### ignore

An array of URIs to be ignored. These URIs will be skipped from the availability checks.

Example:

```
{
  "rules": {
    "no-dead-link": {
      "ignore": [
        "http://example.com/not-exist/index.html"
      ]
    }
  }
}
```

## Tests

```
npm test
```

## Contribution

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## License

MIT License (http://nodaguti.mit-license.org/)
