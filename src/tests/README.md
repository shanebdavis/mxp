# Test Organization

This directory contains tests for the application following a modular testing approach. The test folder structure mirrors the source code structure to maintain clear organization and discoverability.

## Modular Testing Philosophy

Rather than traditional unit/integration/e2e test distinctions, we follow a modular testing approach where:

1. Tests are organized by module, mirroring the source code structure
2. Each module is tested through its public interface (exports)
3. Tests focus on the largest, most impactful modules first
4. Sub-modules are only tested directly when issues are identified or edge cases need coverage

For example:

```
src/
models/
TreeNode.ts
tests/
models/
TreeNode.test.ts
```

## Priority Testing Areas

### Models (`src/models/`)

The `models/` directory contains our core business logic and is a primary focus for testing. We ensure:

- Data structures behave correctly
- Business rules are enforced
- Edge cases are handled
- State transitions work as expected

## Writing Tests

When adding new tests:

1. Create test files in the matching subdirectory under `src/tests/`
2. Name test files with `.test.ts` suffix
3. Focus on testing the public interface
4. Test the happy path first, then edge cases
5. Keep tests focused on module boundaries

## Running Tests

```bash
# Run all tests
npm test

# Run tests for a specific module
npm test -- src/tests/models

# Run a specific test file
npm test -- src/tests/models.test.ts
```
