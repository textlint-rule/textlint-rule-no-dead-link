import { RuleHelper } from 'textlint-rule-helper';
import fetch from 'node-fetch';
import URL from 'url';
import fs from 'fs-extra';
import minimatch from 'minimatch';
import { isAbsolute } from 'path';
import { getURLOrigin } from 'get-url-origin';
import pMemoize from 'p-memoize';
import pAll from 'p-all';

const DEFAULT_OPTIONS = {
  checkRelative: true, // {boolean} `false` disables the checks for relative URIs.
  baseURI: null, // {String|null} a base URI to resolve relative URIs.
  ignore: [], // {Array<String>} URIs to be skipped from availability checks.
  preferGET: [], // {Array<String>} origins to prefer GET over HEAD.
  concurrency: 8, // {number} Concurrency count of  linting link,
  retry: 3, // {number} Count of retring
};

// Adopted from http://stackoverflow.com/a/3809435/951517
const URI_REGEXP = /(?:https?:)?\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_+.~#?&//=]*)/g;

/**
 * Returns `true` if a given URI is https? url.
 * @param {string} uri
 * @return {boolean}
 */
function isHttp(uri) {
  const { protocol } = URL.parse(uri);
  return protocol === 'http:' || protocol === 'https:';
}

/**
 * Returns `true` if a given URI is relative.
 * @param {string} uri
 * @return {boolean}
 * @see https://github.com/panosoft/is-local-path
 */
function isRelative(uri) {
  const { host } = URL.parse(uri);
  return host === null || host === '';
}

/**
 * Returns if a given URI indicates a local file.
 * @param {string} uri
 * @return {boolean}
 * @see https://nodejs.org/api/path.html#path_path_isabsolute_path
 */
function isLocal(uri) {
  if (isAbsolute(uri)) {
    return true;
  }
  return isRelative(uri);
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

function isIgnored(uri, ignore = []) {
  return ignore.some((pattern) => minimatch(uri, pattern));
}

/**
 * Checks if a given URI is alive or not.
 *
 * Normally, this method following strategiry about retry
 *
 * 1. Head
 * 2. Get
 * 3. Get
 *
 * @param {string} uri
 * @param {string} method
 * @param {number} retryCount
 * @return {{ ok: boolean, redirect?: string, message: string }}
 */
async function isAliveURI(uri, method = 'HEAD', retryCount = 3) {
  const { host } = URL.parse(uri);
  const opts = {
    method,
    // Disable gzip compression in Node.js
    // to avoid the zlib's "unexpected end of file" error
    // https://github.com/request/request/issues/2045
    compress: false,
    // Some website require UserAgent and Accept header
    // to avoid ECONNRESET error
    // https://github.com/textlint-rule/textlint-rule-no-dead-link/issues/111
    headers: {
      'User-Agent': 'textlint-rule-no-dead-link/1.0',
      'Accept': '*/*',
      // Same host for target url
      // https://github.com/textlint-rule/textlint-rule-no-dead-link/issues/111
      'Host': host,
    },
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

      const { hash } = URL.parse(uri);
      return {
        ok: finalRes.ok,
        redirected: true,
        redirectTo: hash !== null ? `${finalRes.url}${hash}` : finalRes.url,
        message: `${res.status} ${res.statusText}`,
      };
    }

    if (!res.ok && method === 'HEAD' && retryCount > 0) {
      return isAliveURI(uri, 'GET', retryCount - 1);
    }

    // try to retry if retry count > 0
    if (retryCount > 0) {
      return isAliveURI(uri, 'GET', retryCount - 1);
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
      return isAliveURI(uri, 'GET', retryCount - 1);
    }

    return {
      ok: false,
      message: ex.message,
    };
  }
}

/**
 * Check if a given file exists
 */
async function isAliveLocalFile(filePath) {
  try {
    await fs.access(filePath.replace(/[?#].*?$/, ''));

    return {
      ok: true,
    };
  } catch (ex) {
    return {
      ok: false,
      message: ex.message,
    };
  }
}

function reporter(context, options = {}) {
  const { Syntax, getSource, report, RuleError, fixer, getFilePath } = context;
  const helper = new RuleHelper(context);
  const opts = Object.assign({}, DEFAULT_OPTIONS, options);
  // 30sec cache
  const memorizedIsAliveURI = pMemoize(isAliveURI, {
    maxAge: 30 * 1000,
  });
  /**
   * Checks a given URI's availability and report if it is dead.
   * @param {TextLintNode} node TextLintNode the URI belongs to.
   * @param {string} uri a URI string to be linted.
   * @param {number} index column number the URI is located at.
   * @param {number} retryCount retry count of linting
   */
  const lint = async ({ node, uri, index }, retryCount = opts.retry) => {
    if (isIgnored(uri, opts.ignore)) {
      return;
    }

    if (isRelative(uri)) {
      if (!opts.checkRelative) {
        return;
      }

      const filePath = getFilePath();
      const base = opts.baseURI || filePath;
      if (!base) {
        const message =
          'Unable to resolve the relative URI. Please check if the base URI is correctly specified.';

        report(node, new RuleError(message, { index }));
        return;
      }

      // eslint-disable-next-line no-param-reassign
      uri = URL.resolve(base, uri);
    }

    // Ignore non http external link
    // https://github.com/textlint-rule/textlint-rule-no-dead-link/issues/112
    if (!isLocal(uri) && !isHttp(uri)) {
      return;
    }

    const method =
      opts.preferGET.filter(
        (origin) => getURLOrigin(uri) === getURLOrigin(origin),
      ).length > 0
        ? 'GET'
        : 'HEAD';

    const result = isLocal(uri)
      ? await isAliveLocalFile(uri)
      : await memorizedIsAliveURI(uri, method, retryCount);
    const { ok, redirected, redirectTo, message } = result;

    if (!ok) {
      const lintMessage = `${uri} is dead. (${message})`;
      report(node, new RuleError(lintMessage, { index }));
    } else if (redirected && !opts.ignoreRedirects) {
      const lintMessage = `${uri} is redirected to ${redirectTo}. (${message})`;
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

      // Use `String#replace` instead of `RegExp#exec` to allow us
      // perform RegExp matches in an iterate and immutable manner
      text.replace(URI_REGEXP, (uri, index) => {
        URIs.push({ node, uri, index });
      });
    },

    [Syntax.Link](node) {
      if (helper.isChildNode(node, [Syntax.BlockQuote])) {
        return;
      }

      // Ignore HTML5 place holder link.
      // Ex) <a>Placeholder Link</a>
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
      const linkTasks = URIs.map((item) => () => lint(item));
      return pAll(linkTasks, {
        concurrency: opts.concurrency,
      });
    },
  };
}

export default {
  linter: reporter,
  fixer: reporter,
};
