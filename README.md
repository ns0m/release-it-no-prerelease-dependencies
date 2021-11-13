# No pre-release dependencies plugin for release-it

This [release-it plugin](https://github.com/release-it/release-it/blob/master/docs/plugins/README.md) checks that there are no _npm_ [dependencies](https://docs.npmjs.com/specifying-dependencies-and-devdependencies-in-a-package-json-file) with [pre-release version](https://semver.org/#spec-item-9).

```
npm install --save-dev release-it-no-prerelease-dependencies
```

In [release-it](https://github.com/release-it/release-it) config:

```
"plugins": {
  "release-it-no-prerelease-dependencies": true
}
```
