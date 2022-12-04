import os from 'os';
import fs from 'fs';
import path from 'path';
import test from 'bron';
import assert from 'assert/strict';
import sinon from 'sinon';
import { vol } from 'memfs';
import { patchFs } from 'fs-monkey';
import { factory, runTasks } from 'release-it/test/util/index.js';
import NoPreReleaseDependenciesPlugin from './index.js';

const namespace = JSON.parse(fs.readFileSync('./package.json')).name;

const workingDir = process.cwd();
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rit-plugin-test-'));
process.chdir(testDir);
process.addListener('exit', () => {
  process.chdir(workingDir);
  fs.rmSync(testDir, { recursive: true, force: true });
});
patchFs(vol);

const initVolume = (volumeJson) => {
  vol.reset();
  vol.fromJSON(volumeJson);
};

test('isEnabled true with manifest and modules', () => {
  initVolume({
    './package.json': JSON.stringify({ dependencies: {}, devDependencies: {} }),
    './node_modules': null
  });
  assert.equal(NoPreReleaseDependenciesPlugin.isEnabled(), true);
});

test('isEnabled false without manifest', () => {
  initVolume({
    './node_modules': null
  });
  assert.equal(NoPreReleaseDependenciesPlugin.isEnabled(), false);
});

test('isEnabled false without modules', () => {
  initVolume({
    './package.json': JSON.stringify({ dependencies: {}, devDependencies: {} })
  });
  assert.equal(NoPreReleaseDependenciesPlugin.isEnabled(), false);
});

test('isEnabled false if options=false', () => {
  initVolume({
    './package.json': JSON.stringify({ dependencies: {}, devDependencies: {} }),
    './node_modules': null
  });
  assert.equal(NoPreReleaseDependenciesPlugin.isEnabled(false), false);
});

test('getInitialOptions without includes-excludes options', () => {
  const options = { [namespace]: {} };
  const plugin = factory(NoPreReleaseDependenciesPlugin, { namespace, options });
  assert.deepEqual(plugin.options.includes, []);
  assert.deepEqual(plugin.options.excludes, []);
});

test('getInitialOptions with includes-excludes options', () => {
  const options = { [namespace]: { includes: ['^foo-', '^@bar/'], excludes: ['baz$'] } };
  const plugin = factory(NoPreReleaseDependenciesPlugin, { namespace, options });
  assert.deepEqual(plugin.options.includes, [/^foo-/, /^@bar\//]);
  assert.deepEqual(plugin.options.excludes, [/baz$/]);
});

test('should not throw if no preRelease dependencies', async () => {
  const plugin = factory(NoPreReleaseDependenciesPlugin);
  sinon.stub(plugin, 'hasPreReleaseDependencies').returns(false);
  await assert.doesNotReject(runTasks(plugin));
});

test('should throw if preRelease dependencies', async () => {
  const plugin = factory(NoPreReleaseDependenciesPlugin);
  sinon.stub(plugin, 'hasPreReleaseDependencies').returns(true);
  sinon.stub(plugin, 'getContext').returns({
    preReleaseDependencies: {
      dependencies: {},
      devDependencies: {
        [DEP_INSTALLED_PRE.name]: { range: DEP_INSTALLED_PRE.range, installed: DEP_INSTALLED_PRE.installed }
      }
    }
  });
  await assert.rejects(runTasks(plugin));
});

test('isPreRelease', () => {
  const plugin = factory(NoPreReleaseDependenciesPlugin);
  assert.equal(plugin.isPreRelease('1.0.0-beta.0'), true);
  assert.equal(plugin.isPreRelease('1.0.0-beta'), true);
  assert.equal(plugin.isPreRelease('1.0.0-0'), true);
  assert.equal(plugin.isPreRelease('1.0.0'), false);
  assert.equal(plugin.isPreRelease(null), false);
  assert.equal(plugin.isPreRelease(undefined), false);
});

const DEP_INSTALLED = { name: 'dep-installed', range: '^1.0.0', installed: '1.1.1' };
const DEP_INSTALLED_PRE = { name: 'dep-installed-pre', range: '^3.0.0-pre', installed: '3.0.0-beta.3' };
const DEP_NOT_INSTALLED = { name: 'dep-not-installed', range: '*', installed: undefined };

test('hasPreReleaseDependencies false', () => {
  initVolume({
    './package.json': JSON.stringify({ dependencies: { [DEP_INSTALLED.name]: DEP_INSTALLED.range } })
  });
  const plugin = factory(NoPreReleaseDependenciesPlugin);
  sinon
    .stub(plugin, 'getPreReleaseDependenciesInfo')
    .withArgs({ [DEP_INSTALLED.name]: DEP_INSTALLED.range })
    .returns({})
    .withArgs({})
    .returns({});
  const spySetContext = sinon.spy(plugin, 'setContext');
  const hasPreReleaseDeps = plugin.hasPreReleaseDependencies();
  assert.equal(hasPreReleaseDeps, false);
  assert.equal(spySetContext.callCount, 1);
  assert.deepEqual(spySetContext.getCall(0).args, [
    {
      preReleaseDependencies: {
        dependencies: {},
        devDependencies: {}
      }
    }
  ]);
});

test('hasPreReleaseDependencies true', () => {
  initVolume({
    './package.json': JSON.stringify({ devDependencies: { [DEP_INSTALLED_PRE.name]: DEP_INSTALLED_PRE.range } })
  });
  const plugin = factory(NoPreReleaseDependenciesPlugin);
  sinon
    .stub(plugin, 'getPreReleaseDependenciesInfo')
    .withArgs({})
    .returns({})
    .withArgs({ [DEP_INSTALLED_PRE.name]: DEP_INSTALLED_PRE.range })
    .returns({ [DEP_INSTALLED_PRE.name]: { range: DEP_INSTALLED_PRE.range, installed: DEP_INSTALLED_PRE.installed } });
  const spySetContext = sinon.spy(plugin, 'setContext');
  const hasPreReleaseDeps = plugin.hasPreReleaseDependencies();
  assert.equal(hasPreReleaseDeps, true);
  assert.equal(spySetContext.callCount, 1);
  assert.deepEqual(spySetContext.getCall(0).args, [
    {
      preReleaseDependencies: {
        dependencies: {},
        devDependencies: {
          [DEP_INSTALLED_PRE.name]: { range: DEP_INSTALLED_PRE.range, installed: DEP_INSTALLED_PRE.installed }
        }
      }
    }
  ]);
});

const stubAndCallGetPreReleaseDependenciesInfo = (plugin) => {
  sinon
    .stub(plugin, 'getDependencyEntryVersions')
    .withArgs([DEP_INSTALLED.name, DEP_INSTALLED.range])
    .returns([DEP_INSTALLED.name, { range: DEP_INSTALLED.range, installed: DEP_INSTALLED.installed }])
    .withArgs([DEP_INSTALLED_PRE.name, DEP_INSTALLED_PRE.range])
    .returns([DEP_INSTALLED_PRE.name, { range: DEP_INSTALLED_PRE.range, installed: DEP_INSTALLED_PRE.installed }])
    .withArgs([DEP_NOT_INSTALLED.name, DEP_NOT_INSTALLED.range])
    .returns([DEP_NOT_INSTALLED.name, { range: DEP_NOT_INSTALLED.range, installed: DEP_NOT_INSTALLED.installed }]);
  sinon
    .stub(plugin, 'isPreRelease')
    .withArgs(DEP_INSTALLED.installed)
    .returns(false)
    .withArgs(DEP_INSTALLED_PRE.installed)
    .returns(true);
  return plugin.getPreReleaseDependenciesInfo({
    [DEP_INSTALLED.name]: DEP_INSTALLED.range,
    [DEP_INSTALLED_PRE.name]: DEP_INSTALLED_PRE.range,
    [DEP_NOT_INSTALLED.name]: DEP_NOT_INSTALLED.range
  });
};

test('getPreReleaseDependenciesInfo found', () => {
  const plugin = factory(NoPreReleaseDependenciesPlugin);
  const preReleaseInfo = stubAndCallGetPreReleaseDependenciesInfo(plugin);
  assert.deepEqual(preReleaseInfo, {
    [DEP_INSTALLED_PRE.name]: { range: DEP_INSTALLED_PRE.range, installed: DEP_INSTALLED_PRE.installed }
  });
});

test('getPreReleaseDependenciesInfo but not included', () => {
  const options = { [namespace]: { includes: [`^${DEP_INSTALLED.name}$`, `^${DEP_NOT_INSTALLED.name}$`] } };
  const plugin = factory(NoPreReleaseDependenciesPlugin, { namespace, options });
  const preReleaseInfo = stubAndCallGetPreReleaseDependenciesInfo(plugin);
  assert.deepEqual(preReleaseInfo, {});
});

test('getPreReleaseDependenciesInfo but excluded', () => {
  const options = { [namespace]: { excludes: [`^${DEP_INSTALLED_PRE.name}$`] } };
  const plugin = factory(NoPreReleaseDependenciesPlugin, { namespace, options });
  const preReleaseInfo = stubAndCallGetPreReleaseDependenciesInfo(plugin);
  assert.deepEqual(preReleaseInfo, {});
});

test('getDependencyEntryVersions', () => {
  initVolume({
    './package.json': JSON.stringify({
      dependencies: { [DEP_INSTALLED.name]: DEP_INSTALLED.range },
      devDependencies: { [DEP_NOT_INSTALLED.name]: DEP_NOT_INSTALLED.range }
    }),
    [`./node_modules/${DEP_INSTALLED.name}/package.json`]: JSON.stringify({
      name: DEP_INSTALLED.name,
      version: DEP_INSTALLED.installed
    })
    // no DEP_NOT_INSTALLED on purpose
  });
  const plugin = factory(NoPreReleaseDependenciesPlugin);
  const depInstalledVersions = plugin.getDependencyEntryVersions([DEP_INSTALLED.name, DEP_INSTALLED.range]);
  const depNotInstalledVersions = plugin.getDependencyEntryVersions([DEP_NOT_INSTALLED.name, DEP_NOT_INSTALLED.range]);
  assert.deepEqual(depInstalledVersions, [
    DEP_INSTALLED.name,
    { range: DEP_INSTALLED.range, installed: DEP_INSTALLED.installed }
  ]);
  assert.deepEqual(depNotInstalledVersions, [
    DEP_NOT_INSTALLED.name,
    { range: DEP_NOT_INSTALLED.range, installed: DEP_NOT_INSTALLED.installed }
  ]);
});
