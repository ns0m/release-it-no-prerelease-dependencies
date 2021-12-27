const { EOL } = require('os');
const path = require('path');
const { Plugin } = require('release-it');
const { hasAccess } = require('release-it/lib/util');
const semver = require('semver');

const MANIFEST_PATH = './package.json';
const MODULES_PATH = './node_modules';

class NoPreReleaseDependenciesPlugin extends Plugin {
  static isEnabled(options) {
    return hasAccess(MANIFEST_PATH) && hasAccess(MODULES_PATH) && options !== false;
  }

  getInitialOptions(...args) {
    const initialOptions = super.getInitialOptions(...args);
    initialOptions.includes = []
      .concat(initialOptions.includes)
      .filter(Boolean)
      .map((inc) => new RegExp(inc));
    initialOptions.excludes = []
      .concat(initialOptions.excludes)
      .filter(Boolean)
      .map((exc) => new RegExp(exc));
    return initialOptions;
  }

  init() {
    if (this.hasPreReleaseDependencies()) {
      const { preReleaseDependencies } = this.getContext();
      throw new Error(
        `Dependencies must not have pre-release version:${EOL}${JSON.stringify(preReleaseDependencies, null, 2)}`
      );
    }
  }

  isPreRelease(version) {
    return Boolean(semver.prerelease(version));
  }

  hasPreReleaseDependencies() {
    const { dependencies = {}, devDependencies = {} } = require(path.resolve(MANIFEST_PATH));
    const preReleaseDepsInfo = this.getPreReleaseDependenciesInfo(dependencies);
    const preReleaseDevDepsInfo = this.getPreReleaseDependenciesInfo(devDependencies);
    this.setContext({
      preReleaseDependencies: {
        dependencies: preReleaseDepsInfo,
        devDependencies: preReleaseDevDepsInfo
      }
    });
    return Object.keys(preReleaseDepsInfo).length > 0 || Object.keys(preReleaseDevDepsInfo).length > 0;
  }

  getPreReleaseDependenciesInfo(dependencies) {
    return Object.fromEntries(
      Object.entries(dependencies)
        .map(this.getDependencyEntryVersions, this)
        .filter(([packageName, { installed }]) => {
          const matchFilter = Boolean(installed) && this.isPreRelease(installed);
          if (matchFilter) {
            const isIncluded =
              !this.options.includes.length || this.options.includes.some((incRegExp) => incRegExp.test(packageName));
            const isExcluded = this.options.excludes.some((incRegExp) => incRegExp.test(packageName));
            if (!isIncluded || isExcluded) {
              this.log.warn(
                `Dependency "${packageName}" has been detected with incorrect pre-release version (${installed}) but skipped because of includes-excludes options`
              );
              return false;
            }
          }
          return matchFilter;
        })
    );
  }

  getDependencyEntryVersions([packageName, versionRange]) {
    let installedVersion;
    try {
      installedVersion = require(path.resolve(MODULES_PATH, packageName, MANIFEST_PATH)).version;
    } catch (err) {
      this.log.warn(`Failed to get installed version for dependency "${packageName}"`);
    }
    return [packageName, { range: versionRange, installed: installedVersion }];
  }
}

module.exports = NoPreReleaseDependenciesPlugin;
