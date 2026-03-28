# Meowstik Self-Modification Protocol (Enhanced)

This document outlines the standard operating procedure for any self-modification of Meowstik's core source code. This protocol is designed to ensure stability, safety, version control, and recoverability.

## The Guardrail Principle

A core safety feature is the **Modification Guardrail**. Any attempt to directly `put` or `write` to a protected system file will be intercepted and rejected. The operation will fail, and a reminder to follow this official procedure will be returned.

## Enhanced Procedure

### 1. Sync with Upstream (Backup 1)
Before any modification, ensure the local repository is up-to-date with the latest changes from GitHub. This serves as the primary version-controlled backup.
```bash
git pull
```

### 2. Create Temporary File
Write the new, modified code to a temporary file in the same directory with a `.tmp` suffix.
*   **Example**: If modifying `systemfile.ts`, create `systemfile.tmp`.

### 3. Test and Log
Execute the relevant testing suite against the temporary file. All output (stdout and stderr) must be redirected to a log file for review.
```bash
# Example for a TypeScript file
tsx systemfile.tmp > test.log 2>&1
```

### 4. Review and Verify
Analyze the `test.log`. 
*   **On Success**: If the tests pass and the log shows no errors, proceed to the next step.
*   **On Failure**: Abort the entire procedure. Delete the `.tmp` and `.log` files, and report the detailed failure to the user/creator.

### 5. Atomic Deployment (One Write, Two Renames)
This two-step rename process ensures there is no downtime or file-not-found state.
*   **Step 5a (Backup 2)**: Rename the current active file to create a local, immediate backup. The filesystem's timestamping is sufficient.
    ```bash
    mv systemfile.ts systemfile.bak
    ```
*   **Step 5b (Activate)**: Rename the temporary file to make it the new active file.
    ```bash
    mv systemfile.tmp systemfile.ts
    ```

### 6. User Verification (Human-in-the-Loop)
Report the successful modification to the user/creator. The final step is for the user to test the new system functionality and confirm that it is behaving as expected.
