import TextlintTester from "textlint-tester";
import fs from "fs";
import path from "path";
import rule from "../src/no-dead-link";

const tester = new TextlintTester();

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
        "should treat 200 OK as alive: https://tools-httpstatus.pickup-services.com/200",
        // SKIP: External service test
        // "should treat 200 OK. It require User-Agent: Navigate to [MySQL distribution](https://dev.mysql.com/downloads/mysql/) to install MySQL `5.7`.",
        "should treat 200 OK. It require User-Agent: https://datatracker.ietf.org/doc/html/rfc6749",
        {
            text: "should be able to check a URL in a plain text: https://example.com/",
            ext: ".txt"
        },
        {
            text: "should be able to check multiple URLs in a plain text: https://example.com/, https://tools-httpstatus.pickup-services.com/200",
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
        // SKIP: External service tests (npmjs.com)
        // {
        //     text: "should success with GET method: [npm results for textlint](https://www.npmjs.com/search?q=textlint)",
        //     options: {
        //         preferGET: ["https://www.npmjs.com"]
        //     }
        // },
        // {
        //     text: "should success with GET method whether the option is specific URL: [npm results for textlint](https://www.npmjs.com/search?q=textlint)",
        //     options: {
        //         preferGET: ["https://www.npmjs.com/search?q=textlint-rule"]
        //     }
        // },
        // SKIP: This redirect test fails because the redirect target (httpstat.us) is down
        // {
        //     text: "should not treat https://tools-httpstatus.pickup-services.com/301 when `ignoreRedirects` is true",
        //     options: {
        //         ignoreRedirects: true
        //     }
        // },
        {
            text: "should preserve hash while ignoring redirect: [BDD](http://mochajs.org/#bdd)",
            options: {
                ignoreRedirects: true
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
        // SKIP: Redirect tests - tools-httpstatus redirects to httpstat.us which is down
        // {
        //     text: "should treat 301 https://tools-httpstatus.pickup-services.com/301",
        //     output: "should treat 301 https://httpstat.us/",
        //     errors: [
        //         {
        //             message: "https://tools-httpstatus.pickup-services.com/301 is redirected to https://httpstat.us/. (301 Moved Permanently)",
        //             range: [17, 68]
        //         }
        //     ]
        // },
        // {
        //     text: "should treat 301 [link](https://tools-httpstatus.pickup-services.com/301)",
        //     output: "should treat 301 [link](https://httpstat.us/)",
        //     errors: [
        //         {
        //             message: "https://tools-httpstatus.pickup-services.com/301 is redirected to https://httpstat.us/. (301 Moved Permanently)",
        //             range: [24, 75]
        //         }
        //     ]
        // },
        // {
        //     text: "should treat 302 [link](https://tools-httpstatus.pickup-services.com/302)",
        //     output: "should treat 302 [link](https://httpstat.us/)",
        //     errors: [
        //         {
        //             message: "https://tools-httpstatus.pickup-services.com/302 is redirected to https://httpstat.us/. (302 Found)",
        //             line: 1,
        //             column: 25
        //         }
        //     ]
        // },
        {
            text: "should treat 404 Not Found as dead: https://tools-httpstatus.pickup-services.com/404",
            errors: [
                {
                    message: "https://tools-httpstatus.pickup-services.com/404 is dead. (404 Not Found)",
                    line: 1,
                    column: 37
                }
            ]
        },
        {
            text: "should treat 500 Internal Server Error as dead: https://tools-httpstatus.pickup-services.com/500",
            errors: [
                {
                    message: "https://tools-httpstatus.pickup-services.com/500 is dead. (500 Internal Server Error)",
                    line: 1,
                    column: 49
                }
            ]
        },
        {
            text: "should locate the exact index of a URL in a plain text: https://tools-httpstatus.pickup-services.com/404",
            ext: ".txt",
            errors: [
                {
                    message: "https://tools-httpstatus.pickup-services.com/404 is dead. (404 Not Found)",
                    line: 1,
                    column: 57
                }
            ]
        },
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
        {
            text: `Support Reference link[^1] in Markdown.

[^1] https://tools-httpstatus.pickup-services.com/404`,
            errors: [
                {
                    message: "https://tools-httpstatus.pickup-services.com/404 is dead. (404 Not Found)",
                    loc: {
                        start: {
                            line: 3,
                            column: 6
                        },
                        end: {
                            line: 3,
                            column: 54
                        }
                    }
                }
            ]
        }
    ]
});
