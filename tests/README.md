# HACS Review Regression Tests

The tests run the real card classes in a headless browser and cover HTML injection, Markdown link schemes, sensor substitution, Finance refreshes, Container state propagation, Entities captions and Sun title/background injection.

With Node.js and Playwright installed:

```sh
node --test tests/hacs-review.test.cjs
```

The default browser is Google Chrome. Set `PLAYWRIGHT_CHANNEL=chromium` to use Playwright's Chromium instead. `PLAYWRIGHT_MODULE` can point to an existing Playwright installation.

In the fragment workspace the tests load the relevant fragments. In the release repository they load `auri-ager.js`. Set `AURI_BUNDLE` to an explicit bundle path to test another version.
