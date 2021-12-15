# No pre-release dependencies plugin for release-it [![Latest Published Version](https://img.shields.io/npm/v/release-it-no-prerelease-dependencies)](https://www.npmjs.com/package/release-it-no-prerelease-dependencies) ![Coverage](https://img.shields.io/badge/coverage-100%25-success)

This [release-it plugin](https://github.com/release-it/release-it/blob/master/docs/plugins.md) checks that there are no _npm_ [dependencies](https://docs.npmjs.com/specifying-dependencies-and-devdependencies-in-a-package-json-file) with [pre-release version](https://semver.org/#spec-item-9).

```
npm install --save-dev release-it-no-prerelease-dependencies
```

In [release-it](https://github.com/release-it/release-it) config:

```
"plugins": {
  "release-it-no-prerelease-dependencies": true
}
```
