#!/usr/bin/env node

import { runHairRodReference } from "../physics/labs/hair_material/demo/rod_reference.js";

const first = runHairRodReference();
const second = runHairRodReference();
console.log(
  JSON.stringify(
    {
      ...first,
      deterministic_rerun_matches: JSON.stringify(first.receipt) === JSON.stringify(second.receipt),
    },
    null,
    2
  )
);
