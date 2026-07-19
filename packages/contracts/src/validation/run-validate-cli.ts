import { validateAllExamples } from "./validate-examples.js";

const results = validateAllExamples();
let failed = 0;

for (const result of results) {
  if (result.ok) {
    console.log(`OK  ${result.schemaId} ← ${result.example}`);
  } else {
    failed += 1;
    console.error(`FAIL ${result.schemaId} ← ${result.example}`);
    console.error(result.errors);
  }
}

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} example(s) failed schema validation.`);
} else {
  console.log(`\nAll ${results.length} contract examples are valid (freeze v0).`);
}
