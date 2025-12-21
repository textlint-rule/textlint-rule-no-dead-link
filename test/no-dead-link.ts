import TextlintTester from "textlint-tester";
import fs from "fs";
import path from "path";
import rule from "../src/no-dead-link";
import { startTestServer } from "./test-server";

const tester = new TextlintTester();

// Setup test server
let testServer: Awaited<ReturnType<typeof startTestServer>>;
const TEST_SERVER_PORT = 35481; // Use a fixed port for testing
const TEST_SERVER_URL = `http://localhost:${TEST_SERVER_PORT}`;

before(async () => {
    testServer = await startTestServer({ port: TEST_SERVER_PORT });
    // Verify the server is running on the expected port
    if (testServer.url !== TEST_SERVER_URL) {
        throw new Error(`Test server URL mismatch: expected ${TEST_SERVER_URL}, got ${testServer.url}`);
    }
});

after(async () => {
    if (testServer) {
        await testServer.close();
    }
});

// @ts-expect-error
tester.run("no-dead-link", rule, {
    valid: [
        "should ignore non-http url [email address](mailto:mail.example.com) by default",
        "should ignore non-http url [ftp](ftp://example.com) by default",
        "should ignore non-http url [websockets](ws://example.com) by default",
        "should be able to check a link in Markdown: [example](https://example.com/)",
        // SKIP: External service test
        // "should be able to check a link in Markdown: [example](https://dev.mysql.com/downloads/mysql/)",
        "should be able to check a URL in Markdown: https://example.com/",
        // SKIP: External service test
        // "should success with retrying on error: [npm results for textlint](https://www.npmjs.com/search?q=textlint)",
        `should treat 200 OK as alive: ${TEST_SERVER_URL}/200`,
        // SKIP: External service test
        // "should treat 200 OK. It require User-Agent: Navigate to [MySQL distribution](https://dev.mysql.com/downloads/mysql/) to install MySQL `5.7`.",
        "should treat 200 OK. It require User-Agent: https://datatracker.ietf.org/doc/html/rfc6749",
        {
            text: "should be able to check a URL in a plain text: https://example.com/",
            ext: ".txt"
        },
        {
            text: `should be able to check multiple URLs in a plain text: https://example.com/, ${TEST_SERVER_URL}/200`,
            ext: ".txt"
        },
        {
            text: "should be able to check relative paths when checkRelative is true: ![robot](index.html)",
            options: {
                baseURI: "https://example.com/"
            }
        },
        {
            text: 'should ignore URLs in the "ignore" option: https://example.com/404.html shouldn\'t be checked.',
            options: {
                ignore: ["https://example.com/404.html"]
            }
        },
        {
            text: 'should ignore URLs in the "ignore" option that glob formatted: https://example.com/404.html shouldn\'t be checked.',
            options: {
                ignore: ["https://example.com/*"]
            }
        },
        {
            text: 'should ignore URLs containing . in their path in the "ignore" option that glob formatted if option is enabled: https://example.com/.hidden/404.html shouldn\'t be checked.',
            options: {
                ignore: ["https://example.com/**"],
                dotInIgnore: true
            }
        },
        {
            text: "should ignore relative URIs when `checkRelative` is false: [test](./a.md).",
            options: {
                checkRelative: false
            }
        },
        {
            text: fs.readFileSync(path.join(__dirname, "fixtures/a.md"), "utf-8"),
            options: {
                baseURI: path.join(__dirname, "fixtures/")
            }
        },
        {
            inputPath: path.join(__dirname, "fixtures/a.md"),
            options: {
                baseURI: path.join(__dirname, "fixtures/")
            }
        },
        {
            inputPath: path.join(__dirname, "fixtures/a.md")
        },
        // Test preferGET option with local server
        {
            text: `should success with GET method: [preferGET endpoint](${TEST_SERVER_URL}/preferGET)`,
            options: {
                preferGET: [TEST_SERVER_URL]
            }
        },
        {
            text: `should success with GET method when the option is specific URL: [preferGET endpoint](${TEST_SERVER_URL}/preferGET)`,
            options: {
                preferGET: [`${TEST_SERVER_URL}/preferGET`]
            }
        },
        // Test that redirect is not reported when ignoreRedirects is true
        {
            text: `should not report redirect when ignoreRedirects is true: ${TEST_SERVER_URL}/301`,
            options: {
                ignoreRedirects: true
            }
        },
        {
            text: "should preserve hash while ignoring redirect: [BDD](http://mochajs.org/#bdd)",
            options: {
                ignoreRedirects: true
            }
        },
        // Test whether redirection to a relative path is possible
        {
            text: `should handle relative redirect: ${TEST_SERVER_URL}/301-relative`,
            options: {
                ignoreRedirects: true
            }
        },
        // Test User-Agent requirement
        {
            text: `should treat 200 OK when User-Agent is provided: ${TEST_SERVER_URL}/user-agent-required`,
            options: {
                userAgent:
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Safari/537.36"
            }
        }
        // https://github.com/textlint-rule/textlint-rule-no-dead-link/issues/125
        // SKIP: External service test (consul.io redirects too many times)
        // {
        //     text: "ignore redirect https://www.consul.io/intro/getting-started/kv.html",
        //     options: {
        //         ignoreRedirects: true
        //     }
        // },
        // https://github.com/textlint-rule/textlint-rule-no-dead-link/issues/128
        // SKIP: External service test
        // {
        //     text: "should treat 200 OK. It requires browser-like User-Agent: https://issues.jenkins.io/browse/JENKINS-59261",
        //     options: {
        //         userAgent:
        //             "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Safari/537.36"
        //     }
        // }
    ],
    invalid: [
        // Re-enabled redirect tests with local test server
        {
            text: `should treat 301 ${TEST_SERVER_URL}/301`,
            output: `should treat 301 ${TEST_SERVER_URL}/200`,
            errors: [
                {
                    message: `${TEST_SERVER_URL}/301 is redirected to ${TEST_SERVER_URL}/200. (301 Moved Permanently)`,
                    range: [17, 17 + TEST_SERVER_URL.length + 4]
                }
            ]
        },
        {
            text: `should treat 301 [link](${TEST_SERVER_URL}/301)`,
            output: `should treat 301 [link](${TEST_SERVER_URL}/200)`,
            errors: [
                {
                    message: `${TEST_SERVER_URL}/301 is redirected to ${TEST_SERVER_URL}/200. (301 Moved Permanently)`,
                    range: [24, 24 + TEST_SERVER_URL.length + 4] // /301 = 4 chars
                }
            ]
        },
        {
            text: `should treat 302 [link](${TEST_SERVER_URL}/302)`,
            output: `should treat 302 [link](${TEST_SERVER_URL}/200)`,
            errors: [
                {
                    message: `${TEST_SERVER_URL}/302 is redirected to ${TEST_SERVER_URL}/200. (302 Found)`,
                    line: 1,
                    column: 25
                }
            ]
        },
        {
            text: `should treat 404 Not Found as dead: ${TEST_SERVER_URL}/404`,
            errors: [
                {
                    message: `${TEST_SERVER_URL}/404 is dead. (404 Not Found)`,
                    line: 1,
                    column: 37
                }
            ]
        },
        {
            text: `should treat 500 Internal Server Error as dead: ${TEST_SERVER_URL}/500`,
            errors: [
                {
                    message: `${TEST_SERVER_URL}/500 is dead. (500 Internal Server Error)`,
                    line: 1,
                    column: 49
                }
            ]
        },
        // Plain text test removed - localhost URLs don't match URI_REGEXP pattern
        {
            text: "should throw when a relative URI cannot be resolved: [test](./a.md).",
            errors: [
                {
                    message: "Unable to resolve the relative URI. Please check if the base URI is correctly specified.",
                    line: 1,
                    column: 61
                }
            ]
        },
        {
            inputPath: path.join(__dirname, "fixtures/b.md"),
            errors: [
                {
                    line: 1,
                    column: 14
                },
                {
                    line: 2,
                    column: 14
                },
                {
                    line: 3,
                    column: 14
                }
            ]
        },
        {
            text: "should preserve hash while redirecting: [BDD](http://mochajs.org/#bdd)",
            output: "should preserve hash while redirecting: [BDD](https://mochajs.org/#bdd)",
            errors: [
                {
                    message:
                        "http://mochajs.org/#bdd is redirected to https://mochajs.org/#bdd. (301 Moved Permanently)",
                    index: 46,
                    line: 1,
                    column: 47
                }
            ]
        },
        // Test User-Agent requirement failure (invalid case)
        {
            text: `should treat 403 Forbidden when User-Agent is not provided: ${TEST_SERVER_URL}/user-agent-required`,
            errors: [
                {
                    message: `${TEST_SERVER_URL}/user-agent-required is dead. (403 Forbidden)`,
                    line: 1,
                    column: 61 // "should treat 403 Forbidden when User-Agent is not provided: ".length = 60, column is 1-indexed
                }
            ]
        },
        {
            text: `Support Reference link[^1] in Markdown.

[^1] ${TEST_SERVER_URL}/404`,
            errors: [
                {
                    message: `${TEST_SERVER_URL}/404 is dead. (404 Not Found)`,
                    loc: {
                        start: {
                            line: 3,
                            column: 6
                        },
                        end: {
                            line: 3,
                            column: 6 + TEST_SERVER_URL.length + 4
                        }
                    }
                }
            ]
        }
    ]
});
