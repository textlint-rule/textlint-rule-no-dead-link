import { RuleHelper } from 'textlint-rule-helper';
import fetch from 'isomorphic-fetch';
import URL from 'url';

const DEFAULT_OPTIONS = {
  checkRelative: false, // `true` enables availability checks for relative URIs.
  baseURI: null, // a base URI to resolve relative URIs.
  ignore: [], // URIs to be skipped from availability checks.
};

// Adopted from http://stackoverflow.com/a/3809435/951517
const URI_REGEXP = /(https?:)?\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g;

/**
 * Returns `true` if a given URI is relative.
 * @param {string} uri
 * @return {boolean}
 */
function isRelative(uri) {
  return URL.parse(uri).protocol === null;
}

/**
 * Return `true` if the `code` is redirect status code.
 * @see https://fetch.spec.whatwg.org/#redirect-status
 * @param {number} code
 * @returns {boolean}
 */
function isRedirect(code) {
  return (
    code === 301 || code === 302 || code === 303 || code === 307 || code === 308
  );
}

/**
 * Checks if a given URI is alive or not.
 * @param {string} uri
 * @param {string} method
 * @return {{ ok: boolean, redirect?: string, message: string }}
 */
async function isAlive(uri, method = 'HEAD') {
  const opts = {
    method,
    // Disable gzip compression in Node.js
    // to avoid the zlib's "unexpected end of file" error
    // https://github.com/request/request/issues/2045
    compress: false,
    // Use `manual` redirect behaviour to get HTTP redirect status code
    // and see what kind of redirect is occurring
    redirect: 'manual',
  };

  try {
    const res = await fetch(uri, opts);

    if (isRedirect(res.status)) {
      const finalRes = await fetch(
        uri,
        Object.assign({}, opts, { redirect: 'follow' }),
      );

      return {
        ok: finalRes.ok,
        redirected: true,
        redirectTo: finalRes.url,
        message: `${res.status} ${res.statusText}`,
      };
    }

    return {
      ok: res.ok,
      message: `${res.status} ${res.statusText}`,
    };
  } catch (ex) {
    // Retry with `GET` method if the request failed
    // as some servers don't accept `HEAD` requests but are OK with `GET` requests.
    // https://github.com/textlint-rule/textlint-rule-no-dead-link/pull/86
    if (method === 'HEAD') {
      return isAlive(uri, 'GET');
    }

    return {
      ok: false,
      message: ex.message,
    };
  }
}

function reporter(context, options = {}) {
  const { Syntax, getSource, report, RuleError, fixer } = context;
  const helper = new RuleHelper(context);
  const opts = Object.assign({}, DEFAULT_OPTIONS, options);

  /**
   * Checks a given URI's availability and report if it is dead.
   * @param {TextLintNode} node TextLintNode the URI belongs to.
   * @param {string} uri a URI string to be linted.
   * @param {number} index column number the URI is located at.
   */
  const lint = async ({ node, uri, index }) => {
    if (opts.ignore.indexOf(uri) !== -1) {
      return;
    }

    if (isRelative(uri)) {
      if (!opts.checkRelative) {
        return;
      }

      if (!opts.baseURI) {
        const message = 'The base URI is not specified.';
        report(node, new RuleError(message, { index: 0 }));
        return;
      }

      // eslint-disable-next-line no-param-reassign
      uri = URL.resolve(opts.baseURI, uri);
    }

    const result = await isAlive(uri);
    const { ok, redirected, redirectTo, message } = result;

    if (!ok) {
      const lintMessage = `${uri} is dead. (${message})`;

      report(node, new RuleError(lintMessage, { index }));
    } else if (redirected) {
      const lintMessage = `${uri} is redirected. (${message})`;
      const fix = fixer.replaceTextRange(
        [index, index + uri.length],
        redirectTo,
      );

      report(node, new RuleError(lintMessage, { fix, index }));
    }
  };

  /**
   * URIs to be checked.
   * @type {Array<{ node: TextLintNode, uri: string, index: number }>}
   */
  const URIs = [];

  return {
    [Syntax.Str](node) {
      if (helper.isChildNode(node, [Syntax.BlockQuote])) {
        return;
      }

      // prevent double checks
      if (helper.isChildNode(node, [Syntax.Link])) {
        return;
      }

      const text = getSource(node);
      let matched;

      // eslint-disable-next-line no-cond-assign
      while ((matched = URI_REGEXP.exec(text))) {
        const uri = matched[0];
        const { index } = matched;
        URIs.push({ node, uri, index });
      }
    },

    [Syntax.Link](node) {
      if (helper.isChildNode(node, [Syntax.BlockQuote])) {
        return;
      }
      // Ignore HTML5 place holder link. Ex) <a>Placeholder Link</a>
      if (typeof node.url === 'undefined') {
        return;
      }
      // [text](http://example.com)
      //       ^
      const index = node.raw.indexOf(node.url) || 0;
      URIs.push({
        node,
        uri: node.url,
        index,
      });
    },

    [`${context.Syntax.Document}:exit`]() {
      return Promise.all(URIs.map((item) => lint(item)));
    },
  };
}

export default {
  linter: reporter,
  fixer: reporter,
};
