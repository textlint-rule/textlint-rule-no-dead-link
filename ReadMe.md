# textlint-rule-no-dead-link

[![textlint rule](https://img.shields.io/badge/textlint-fixable-green.svg?style=social)](https://textlint.github.io/)
[![npm version](https://badge.fury.io/js/textlint-rule-no-dead-link.svg)](https://badge.fury.io/js/textlint-rule-no-dead-link)
[![Build Status](https://travis-ci.org/textlint-rule/textlint-rule-no-dead-link.svg?branch=master)](https://travis-ci.org/textlint-rule/textlint-rule-no-dead-link)
[![Dependency Status](https://david-dm.org/textlint-rule/textlint-rule-no-dead-link.svg)](https://david-dm.org/textlint-rule/textlint-rule-no-dead-link)
[![devDependency Status](https://david-dm.org/textlint-rule/textlint-rule-no-dead-link/dev-status.svg)](https://david-dm.org/textlint-rule/textlint-rule-no-dead-link#info=devDependencies)

[textlint](https://github.com/textlint/textlint) rule
to make sure every link in a document is available.

The primary target of this rule is Markdown documents, while it may also work for plain text documents (See tests).

## Installation

```
$ npm install textlint-rule-no-dead-link
```

## Usage

```
$ npm install textlint textlint-rule-no-dead-link
$ textlint --rule textlint-rule-no-dead-link text-to-check.txt
```

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

An array of URIs to be ignored, i.e. skipped from availability checks.

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
