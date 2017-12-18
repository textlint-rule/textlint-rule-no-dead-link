/* eslint-disable max-len */
import TextlintTester from 'textlint-tester';
import fs from 'fs';
import path from 'path';
import rule from '../src/no-dead-link';

const tester = new TextlintTester();

tester.run('no-dead-link', rule, {
  valid: [
    'should be able to check a link in Markdown: [example](https://example.com/)',
    'should be able to check a URL in Markdown: https://example.com/',
    'should treat 200 OK as alive: https://httpstat.us/200',
    {
      text:
        'should be able to check a URL in a plain text: https://example.com/',
      ext: '.txt',
    },
    {
      text:
        'should be able to check multiple URLs in a plain text: https://example.com/, https://httpstat.us/200',
      ext: '.txt',
    },
    {
      text:
        'should be able to check relative pathes when checkRelative is true: ![robot](index.html)',
      options: {
        checkRelative: true,
        baseURI: 'https://example.com/',
      },
    },
    {
      text:
        'should ignore URLs in the "ignore" option: https://example.com/404.html shouldn\'t be checked.',
      options: {
        ignore: ['https://example.com/404.html'],
      },
    },
    {
      text: fs.readFileSync(path.join(__dirname, 'fixtures/a.md'), 'utf-8'),
      options: {
        baseURI: path.join(__dirname, 'fixtures/'),
      },
    },
    {
      inputPath: path.join(__dirname, 'fixtures/a.md'),
      options: {
        baseURI: path.join(__dirname, 'fixtures/'),
      },
    },
    {
      inputPath: path.join(__dirname, 'fixtures/a.md'),
    },
  ],
  invalid: [
    {
      text: 'should treat 301 https://httpstat.us/301',
      output: 'should treat 301 https://httpstat.us/',
      errors: [
        {
          message:
            'https://httpstat.us/301 is redirected to https://httpstat.us/. (301 Moved Permanently)',
          line: 1,
          column: 18,
        },
      ],
    },
    {
      text: 'should treat 301 [link](https://httpstat.us/301)',
      output: 'should treat 301 [link](https://httpstat.us/)',
      errors: [
        {
          message:
            'https://httpstat.us/301 is redirected to https://httpstat.us/. (301 Moved Permanently)',
          line: 1,
          column: 25,
        },
      ],
    },
    {
      text: 'should treat 302 [link](https://httpstat.us/302)',
      output: 'should treat 302 [link](https://httpstat.us/)',
      errors: [
        {
          message:
            'https://httpstat.us/302 is redirected to https://httpstat.us/. (302 Found)',
          line: 1,
          column: 25,
        },
      ],
    },
    {
      text: 'should treat 404 Not Found as dead: https://httpstat.us/404',
      errors: [
        {
          message: 'https://httpstat.us/404 is dead. (404 Not Found)',
          line: 1,
          column: 37,
        },
      ],
    },
    {
      text:
        'should treat 500 Internal Server Error as dead: https://httpstat.us/500',
      errors: [
        {
          message:
            'https://httpstat.us/500 is dead. (500 Internal Server Error)',
          line: 1,
          column: 49,
        },
      ],
    },
    {
      text:
        'should locate the exact index of a URL in a plain text: https://httpstat.us/404',
      ext: '.txt',
      errors: [
        {
          message: 'https://httpstat.us/404 is dead. (404 Not Found)',
          line: 1,
          column: 57,
        },
      ],
    },
    {
      text:
        'should throw when a relative URI cannot be resolved: [test](./a.md).',
      errors: [
        {
          message:
            'Unable to resolve the relative URI. Please check if the base URI is correctly specified.',
          line: 1,
          column: 61,
        },
      ],
    },
    {
      inputPath: path.join(__dirname, 'fixtures/b.md'),
      errors: [
        {
          line: 1,
          column: 14,
        },
        {
          line: 2,
          column: 14,
        },
        {
          line: 3,
          column: 14,
        },
      ],
    },
  ],
});
