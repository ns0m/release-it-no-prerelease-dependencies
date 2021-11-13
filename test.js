const test = require('bron');
const assert = require('assert');
const { factory, runTasks } = require('release-it/test/util');
const Plugin = require('.');

test('should not throw', async t => {
  const plugin = factory(Plugin);
  await assert.doesNotReject(runTasks(plugin));
});
