# TwinForge Studio · Agent Rules & Constraints

1. **No False Success or Silent Emulation**:
   - Never add a fallback or emulation that makes a failed operation look successful.
   - Always throw a clear, descriptive error instead.

2. **Strict Documentation Truthfulness**:
   - Never write README, report, or UI text claiming something the code does not do.
   - All documentation and UI claims must be backed by actual code implementation.

3. **Mandatory Pre-Commit Verification Pipeline**:
   - Run `npx tsc -b`, `npx oxlint`, and `npm test` after every change.
   - Do NOT commit if any of these checks fail.

4. **One Fix Per Commit**:
   - Keep commits atomic, isolated, and strictly focused on a single fix.
