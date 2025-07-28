import * as core from '@actions/core';
import { run } from './main';

run().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  core.setFailed(msg);
}); 