const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('bron');
const assert = require('assert').strict;
const sinon = require('sinon');
const { vol } = require('memfs');
const { patchFs, patchRequire } = require('fs-monkey');
const { factory, runTasks } = require('release-it/test/util');
const Plugin = require('.');

const workingDir = process.cwd();
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rit-plugin-test-'));
process.chdir(testDir);
process.addListener('exit', () => {
  process.chdir(workingDir);
  fs.rmSync(testDir, { recursive: true, force: true });
});
patchFs(vol);
patchRequire(vol, true);

const initVolume = (volumeJson) => {
  vol.reset();
  Object.keys(require.cache)
    .filter((key) => key.includes(path.basename(testDir)))
    .forEach((key) => {
      delete require.cache[key];
    });
  vol.fromJSON(volumeJson);
};

test('isEnabled true with manifest and modules', (t) => {
  initVolume({
    './package.json': JSON.stringify({ dependencies: {}, devDependencies: {} }),
    './node_modules': null
  });
  assert.equal(Plugin.isEnabled(), true);
});

test('isEnabled false without manifest', (t) => {
  initVolume({
    './node_modules': null
  });
  assert.equal(Plugin.isEnabled(), false);
});

test('isEnabled false without modules', (t) => {
  initVolume({
    './package.json': JSON.stringify({ dependencies: {}, devDependencies: {} })
  });
  assert.equal(Plugin.isEnabled(), false);
});

test('isEnabled false if options=false', (t) => {
  initVolume({
    './package.json': JSON.stringify({ dependencies: {}, devDependencies: {} }),
    './node_modules': null
  });
  assert.equal(Plugin.isEnabled(false), false);
});

test('should not throw if no preRelease dependencies', async (t) => {
  const plugin = factory(Plugin);
  sinon.stub(plugin, 'hasPreReleaseDependencies').returns(false);
  await assert.doesNotReject(runTasks(plugin));
});

test('should throw if preRelease dependencies', async (t) => {
  const plugin = factory(Plugin);
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

test('isPreRelease', (t) => {
  const plugin = factory(Plugin);
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

test('hasPreReleaseDependencies false', (t) => {
  initVolume({
    './package.json': JSON.stringify({ dependencies: { [DEP_INSTALLED.name]: DEP_INSTALLED.range } })
  });
  const plugin = factory(Plugin);
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

test('hasPreReleaseDependencies true', (t) => {
  initVolume({
    './package.json': JSON.stringify({ devDependencies: { [DEP_INSTALLED_PRE.name]: DEP_INSTALLED_PRE.range } })
  });
  const plugin = factory(Plugin);
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

test('getPreReleaseDependenciesInfo', (t) => {
  const plugin = factory(Plugin);
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
  const preReleaseInfo = plugin.getPreReleaseDependenciesInfo({
    [DEP_INSTALLED.name]: DEP_INSTALLED.range,
    [DEP_INSTALLED_PRE.name]: DEP_INSTALLED_PRE.range,
    [DEP_NOT_INSTALLED.name]: DEP_NOT_INSTALLED.range
  });
  assert.deepEqual(preReleaseInfo, {
    [DEP_INSTALLED_PRE.name]: { range: DEP_INSTALLED_PRE.range, installed: DEP_INSTALLED_PRE.installed }
  });
});

test('getDependencyEntryVersions', (t) => {
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
  const plugin = factory(Plugin);
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
