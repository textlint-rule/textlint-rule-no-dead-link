import { RuleHelper } from "textlint-rule-helper";
import fetch, { RequestInit } from "node-fetch";
import URL from "url";
import fs from "fs/promises";
import minimatch from "minimatch";
import { isAbsolute } from "path";
import { getURLOrigin } from "get-url-origin";
import pMemoize from "p-memoize";
import PQueue from "p-queue";
import type { TextlintRuleReporter } from "@textlint/types";
import type { TxtNode } from "@textlint/ast-node-types";

export type Options = {
    checkRelative: boolean; // {boolean} `false` disables the checks for relative URIs.
    baseURI: null | string; // {String|null} a base URI to resolve relative URIs.
    ignore: string[]; // {Array<String>} URIs to be skipped from availability checks.
    dotInIgnore: boolean; // {boolean} `true` allows ignore patterns to match filenames starting with a period
    ignoreRedirects: boolean; // {boolean} `false` ignores redirect status codes.
    preferGET: string[]; // {Array<String>} origins to prefer GET over HEAD.
    retry: number; // {number} Max retry count
    concurrency: number; // {number} Concurrency count of linting link [Experimental]
    interval: number; // The length of time in milliseconds before the interval count resets. Must be finite. [Experimental]
    intervalCap: number; // The max number of runs in the given interval of time. [Experimental]
    userAgent: string; // {String} a UserAgent,
    maxRetryTime: number; // (number) The max of waiting seconds for retry. It is related to `retry` option. It does affect to `Retry-After` header.
    maxRetryAfterTime: number; // (number) The max of waiting seconds for `Retry-After` header.
};
const DEFAULT_OPTIONS: Options = {
    checkRelative: true, // {boolean} `false` disables the checks for relative URIs.
    baseURI: null, // {String|null} a base URI to resolve relative URIs.
    ignore: [], // {Array<String>} URIs to be skipped from availability checks.
    dotInIgnore: false, // {boolean} `true` allows ignore patterns to match filenames starting with a period
    ignoreRedirects: false, // {boolean} `false` ignores redirect status codes.
    preferGET: [], // {Array<String>} origins to prefer GET over HEAD.
    retry: 3, // {number} Max retry count
    concurrency: 8, // {number} Concurrency count of linting link [Experimental]
    interval: 500, // The length of time in milliseconds before the interval count resets. Must be finite. [Experimental]
    intervalCap: 8, // The max number of runs in the given interval of time. [Experimental]
    userAgent: "textlint-rule-no-dead-link/1.0", // {String} a UserAgent,
    maxRetryTime: 10, // (number) The max of waiting seconds for retry. It is related to `retry` option. It does affect to `Retry-After` header.
    maxRetryAfterTime: 10 // (number) The max of waiting seconds for `Retry-After` header.
};

// Adopted from http://stackoverflow.com/a/3809435/951517
const URI_REGEXP =
    /(?:https?:)?\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_+.~#?&//=]*)/g;

/**
 * Returns `true` if a given URI is https? url.
 * @param {string} uri
 * @return {boolean}
 */
function isHttp(uri: string) {
    const { protocol } = URL.parse(uri);
    return protocol === "http:" || protocol === "https:";
}

/**
 * Returns `true` if a given URI is relative.
 * @param {string} uri
 * @return {boolean}
 * @see https://github.com/panosoft/is-local-path
 */
function isRelative(uri: string) {
    const { host } = URL.parse(uri);
    return host === null || host === "";
}

/**
 * Returns if a given URI indicates a local file.
 * @param {string} uri
 * @return {boolean}
 * @see https://nodejs.org/api/path.html#path_path_isabsolute_path
 */
function isLocal(uri: string) {
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
function isRedirect(code: number) {
    return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
}

function isIgnored(uri: string, ignore: string[] = [], dotInIgnore: boolean) {
    return ignore.some((pattern) => minimatch(uri, pattern, { dot: dotInIgnore }));
}

/**
 * wait for ms and resolve the promise
 * @param ms
 * @returns {Promise<any>}
 */
function waitTimeMs(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const createFetchWithRuleDefaults = (ruleOptions: Options) => {
    return (uri: string, fetchOptions: RequestInit) => {
        const { host } = URL.parse(uri);
        return fetch(uri, {
            ...fetchOptions,
            // Disable gzip compression in Node.js
            // to avoid the zlib's "unexpected end of file" error
            // https://github.com/request/request/issues/2045
            compress: false,
            // Some website require UserAgent and Accept header
            // to avoid ECONNRESET error
            // https://github.com/textlint-rule/textlint-rule-no-dead-link/issues/111
            headers: {
                "User-Agent": ruleOptions.userAgent,
                Accept: "*/*",
                // avoid assign null to Host
                ...(host
                    ? {
                          // Same host for target url
                          // https://github.com/textlint-rule/textlint-rule-no-dead-link/issues/111
                          Host: host
                      }
                    : {})
            }
        });
    };
};

type AliveFunctionReturn = {
    ok: boolean;
    message: string;
    redirected?: boolean;
    redirectTo?: string | null;
};

/**
 * Create isAliveURI function with ruleOptions
 * @param {object} ruleOptions
 * @returns {isAliveURI}
 */
const createCheckAliveURL = (ruleOptions: Options) => {
    // Create fetch function for this rule
    const fetchWithDefaults = createFetchWithRuleDefaults(ruleOptions);
    /**
     * Checks if a given URI is alive or not.
     *
     * Normally, this method following strategy about retry
     *
     * 1. Head
     * 2. Get
     * 3. Get
     *
     * @param {string} uri
     * @param {string} method
     * @param {number} maxRetryCount
     * @param {number} currentRetryCount
     * @return {{ ok: boolean, redirect?: string, message: string }}
     */
    return async function isAliveURI(
        uri: string,
        method: string = "HEAD",
        maxRetryCount: number = 3,
        currentRetryCount: number = 0
    ): Promise<AliveFunctionReturn> {
        const opts: RequestInit = {
            method,
            // Use `manual` redirect behaviour to get HTTP redirect status code
            // and see what kind of redirect is occurring
            redirect: "manual"
        };
        try {
            const res = await fetchWithDefaults(uri, opts);
            // redirected
            if (isRedirect(res.status)) {
                const redirectedUrl = res.headers.get("Location");
                // Status code is 301 or 302, but Location header is not set
                if (redirectedUrl === null) {
                    return {
                        ok: false,
                        redirected: true,
                        redirectTo: null,
                        message: `${res.status} ${res.statusText}`
                    };
                }
                const finalRes = await fetchWithDefaults(redirectedUrl, { ...opts, redirect: "follow" });
                const { hash } = URL.parse(uri);
                return {
                    ok: finalRes.ok,
                    redirected: true,
                    redirectTo: hash !== null ? `${finalRes.url}${hash}` : finalRes.url,
                    message: `${res.status} ${res.statusText}`
                };
            }
            // retry if it is not ok when use head request
            if (!res.ok && method === "HEAD" && currentRetryCount < maxRetryCount) {
                return isAliveURI(uri, "GET", maxRetryCount, currentRetryCount + 1);
            }

            // try to fetch again if not reach max retry count
            if (currentRetryCount < maxRetryCount) {
                const retryAfter = res.headers.get("Retry-After");
                // If the response has `Retry-After` header, prefer it
                // e.g. `Retry-After: 60` and `maxRetryAfterTime: 90`, wait 60 seconds
                if (retryAfter) {
                    const retryAfterMs = Number(retryAfter) * 1000;
                    const maxRetryAfterTimeMs = ruleOptions.maxRetryAfterTime * 1000;
                    if (retryAfterMs <= maxRetryAfterTimeMs) {
                        await waitTimeMs(retryAfterMs);
                    }
                } else {
                    // exponential retry: 0ms -> 100ms -> 200ms -> 400ms -> 800ms ...
                    const retryWaitTimeMs = currentRetryCount ** 2 * 100;
                    const maxRetryTimeMs = ruleOptions.maxRetryTime * 1000;
                    if (retryWaitTimeMs <= maxRetryTimeMs) {
                        await waitTimeMs(retryWaitTimeMs);
                    }
                }
                return isAliveURI(uri, "GET", maxRetryCount, currentRetryCount + 1);
            }

            return {
                ok: res.ok,
                message: `${res.status} ${res.statusText}`
            };
        } catch (ex: any) {
            // Retry with `GET` method if the request failed
            // as some servers don't accept `HEAD` requests but are OK with `GET` requests.
            // https://github.com/textlint-rule/textlint-rule-no-dead-link/pull/86
            if (method === "HEAD" && currentRetryCount < maxRetryCount) {
                return isAliveURI(uri, "GET", maxRetryCount, currentRetryCount + 1);
            }

            return {
                ok: false,
                message: ex.message
            };
        }
    };
};

/**
 * Check if a given file exists
 */
async function isAliveLocalFile(filePath: string): Promise<AliveFunctionReturn> {
    try {
        await fs.access(filePath.replace(/[?#].*?$/, ""));
        return {
            ok: true,
            message: "OK"
        };
    } catch (ex: any) {
        return {
            ok: false,
            message: ex.message
        };
    }
}

const reporter: TextlintRuleReporter<Options> = (context, options) => {
    const { Syntax, getSource, report, RuleError, fixer, getFilePath, locator } = context;
    const helper = new RuleHelper(context);
    const ruleOptions = { ...DEFAULT_OPTIONS, ...options };
    const isAliveURI = createCheckAliveURL(ruleOptions);
    // 30sec memorized
    const memorizedIsAliveURI = pMemoize(isAliveURI, {
        maxAge: 30 * 1000
    });
    /**
     * Checks a given URI's availability and report if it is dead.
     * @param {TextLintNode} node TextLintNode the URI belongs to.
     * @param {string} uri a URI string to be linted.
     * @param {number} index column number the URI is located at.
     * @param {number} maxRetryCount retry count of linting
     */
    const lint = async ({ node, uri, index }: { node: TxtNode; uri: string; index: number }, maxRetryCount: number) => {
        if (isIgnored(uri, ruleOptions.ignore, ruleOptions.dotInIgnore)) {
            return;
        }

        if (isRelative(uri)) {
            if (!ruleOptions.checkRelative) {
                return;
            }

            const filePath = getFilePath();
            const base = ruleOptions.baseURI || filePath;
            if (!base) {
                const message =
                    "Unable to resolve the relative URI. Please check if the base URI is correctly specified.";

                report(node, new RuleError(message, { padding: locator.range([index, index + uri.length]) }));
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
            ruleOptions.preferGET.filter((origin) => getURLOrigin(uri) === getURLOrigin(origin)).length > 0
                ? "GET"
                : "HEAD";

        const result = isLocal(uri)
            ? await isAliveLocalFile(uri)
            : await memorizedIsAliveURI(uri, method, maxRetryCount);
        const { ok, redirected, redirectTo, message } = result;
        // When ignoreRedirects is true, redirected should be ignored
        if (redirected && ruleOptions.ignoreRedirects) {
            return;
        }
        if (!ok) {
            const lintMessage = `${uri} is dead. (${message})`;
            report(node, new RuleError(lintMessage, { padding: locator.range([index, index + uri.length]) }));
        } else if (redirected) {
            const lintMessage = `${uri} is redirected to ${redirectTo}. (${message})`;
            const fix = redirectTo ? fixer.replaceTextRange([index, index + uri.length], redirectTo) : undefined;
            report(node, new RuleError(lintMessage, { fix, padding: locator.range([index, index + uri.length]) }));
        }
    };

    /**
     * URIs to be checked.
     */
    const URIs: { node: TxtNode; uri: string; index: number }[] = [];

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
            const matches = text.matchAll(URI_REGEXP);
            Array.from(matches).forEach((match) => {
                const url = match[0];
                if (url && match.input !== undefined && match.index !== undefined) {
                    URIs.push({ node, uri: url, index: match.index });
                }
            });
        },

        [Syntax.Link](node) {
            if (helper.isChildNode(node, [Syntax.BlockQuote])) {
                return;
            }

            // Ignore HTML5 place holder link.
            // Ex) <a>Placeholder Link</a>
            if (typeof node.url === "undefined") {
                return;
            }

            // [text](http://example.com)
            //       ^
            const index = node.raw.indexOf(node.url) || 0;

            URIs.push({
                node,
                uri: node.url,
                index
            });
        },

        // Reference links is markdown specific
        Definition: function (node) {
            if (!node.url) {
                return;
            }

            // Some link text[1]
            //
            // [1]: https://foo.bar
            //      ^
            const indexOfUrl = node.raw.indexOf(node.url);
            const index = indexOfUrl !== -1 ? indexOfUrl : 0;
            URIs.push({
                node,
                uri: node.url,
                index
            });
        },

        [Syntax.DocumentExit]() {
            const queue = new PQueue({
                concurrency: ruleOptions.concurrency,
                intervalCap: ruleOptions.intervalCap,
                interval: ruleOptions.interval
            });
            const linkTasks = URIs.map((item) => () => lint(item, ruleOptions.retry));
            return queue.addAll(linkTasks);
        }
    };
};
export default {
    linter: reporter,
    fixer: reporter
};
