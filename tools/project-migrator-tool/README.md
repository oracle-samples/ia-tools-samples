# Project Migrator Tool (OPA to Oracle Intelligent Advisor Hub)

CLI utility to:
- Export Oracle Policy Modeling (OPM) policy-model projects and Decision Service projects (modules) from a database into a single portable zip.
- Import that exported payload into an Oracle Intelligent Advisor (IA) Hub using OAuth, with automatic resume support on failure.

This tool is implemented in Java, packaged as a fat JAR (includes dependencies), and exposes a simple CLI with two modes: `--export` and `--import`.


## Contents
- Overview
- Prerequisites
- Build
- Run
  - Export mode
  - Import mode (with resume)
- Exported payload format (zip contents)
- Import journal format (resume)
- Endpoints and API versions
- Examples
- Troubleshooting
- Development and Testing
- Limitations and Notes


## Overview

- Export mode reads from a MySQL or Oracle database and writes a timestamped zip (export-<millis>.zip) containing:
  - projects.json
  - project_versions.json
  - modules.json
  - module_versions.json
  - one binary file per snapshot (named by its SHA-256 fingerprint)

- Import mode authenticates to an IA Hub via OAuth (client credentials), validates the target environment (project name clashes and workspace existence), and uploads:
  - Policy-model project versions with their snapshot binaries
  - Decision service project versions with their definitions

- Resume support allows continuing from the last successful item using a journal JSONL file. The tool can validate and resume imports if interrupted.


## Prerequisites

- Java: JDK 8+ (built with Java 8 target; newer JDKs are fine for running)
- Gradle: Wrapper included (no global install required)
- Network access to:
  - the source database (export)
  - the IA Hub (import)
- Database:
  - JDBC URL must start with either `jdbc:mysql:` or `jdbc:oracle:` (both supported)
  - Credentials will be prompted on stdin during export
- IA Hub:
  - Base host URL (e.g., `https://ia.example.com`) — trailing slash is accepted and stripped
  - OAuth client credentials (client id + client secret) — prompted on stdin during import


## Build

Using the Gradle wrapper:

```bash
# macOS/Linux
./gradlew clean build

# Windows (PowerShell/CMD)
gradlew.bat clean build
```

The `jar` task is configured to build a self-contained fat JAR with `Main-Class` set to:
```
com.oracle.determinations.migration.Main
```

The JAR will be created under `build/libs/`. It is typically named after the project directory, for example:
```
build/libs/project-migrator-tool.jar
```

Dependencies included in the fat jar:
- MySQL Connector/J 8.3.0
- Oracle JDBC ojdbc8 21.12.0.0
- Apache HttpClient 4.5.14
- org.json 20240303
- commons-codec 1.19.0


## Run

You can run via Java directly or through Gradle’s application plugin.

- Using the JAR:
  ```bash
  java -jar build/libs/project-migrator-tool.jar --export <dbUrl>
  java -jar build/libs/project-migrator-tool.jar --import <IAHostUrl> <exportedPayloadPath> [resumeJournalPath]
  ```

- Using Gradle (runs the same Main class):
  ```bash
  ./gradlew run --args="--export <dbUrl>"
  ./gradlew run --args="--import <IAHostUrl> <exportedPayloadPath> [resumeJournalPath]"
  ```

The CLI will prompt for credentials on stdin:
- Export prompts for database username and password
- Import prompts for IA OAuth client identifier and secret

Note: On some environments without an attached system console (e.g., inside certain IDEs), the password prompt may fall back to visible input.

### Export mode

Usage:
```bash
java -jar project-migrator-tool.jar --export <dbUrl>
```

- Supported JDBC URL schemes:
  - MySQL example:
    ```
    jdbc:mysql://dbhost:3306/opadb?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
    ```
  - Oracle example (service name):
    ```
    jdbc:oracle:thin:@//dbhost:1521/ORCLPDB1
    ```
    or (SID):
    ```
    jdbc:oracle:thin:@dbhost:1521:ORCL
    ```

What it does:
- Loads the appropriate JDBC driver (MySQL or Oracle)
- Connects using supplied credentials
- Exports:
  - policy-model projects and their versions
  - decision service projects (modules) and their versions
  - unique snapshots referenced by project versions
- Writes a timestamped zip like: `export-<millis>.zip`
- Shows progress in the console (e.g., “Exporting project: …”, “Exporting project version: …”)

If the JDBC driver cannot be found based on the URL, the tool will exit with an error suggesting to ensure the correct driver is on the classpath (the fat jar already includes the listed drivers).

### Import mode (with resume)

Usage:
```bash
java -jar project-migrator-tool.jar --import <IAHostUrl> <exportedPayloadPath> [resumeJournalPath]
```

Parameters:
- `<IAHostUrl>`: Base host URL of the IA Hub, e.g. `https://ia.example.com` (trailing slash allowed; it will be stripped)
- `<exportedPayloadPath>`: Path to the exported zip created by this tool
- `[resumeJournalPath]` (optional): A previously written journal file to validate against and resume from

On start, the tool:
1. Computes the SHA-256 of the payload zip.
2. Authenticates to IA Hub with OAuth client credentials (prompted).
3. If resuming:
   - Validates that the journal’s `payload_sha256` matches the payload, and `hub_url` matches the target IA host.
   - Validates the IA Hub already has versions corresponding to prior journal entries.
   - Replays journal entries to the new journal and continues from the next item.
4. If not resuming:
   - Fetches existing projects from the IA Hub and fails fast if there are name clashes:
     ```
     Projects with the following names already exist on the IA Hub: <comma-separated names>
     ```
   - Fetches workspace names and fails fast if any required workspaces are missing:
     ```
     Target hub is missing workspaces: <comma-separated names>
     ```
5. Uploads:
   - OPM policy-model project versions (with snapshot bytes embedded as base64)
   - Decision service project versions (with JSON definition)
6. Writes a new journal file named `import-<millis>.json` (JSON Lines format):
   - First line: header with `payload_sha256` and `hub_url`
   - One line per successful upload, in order

On errors (HTTP non-2xx), the tool prints the HTTP code and response body to aid diagnosis.


## Exported payload format (zip contents)

The export zip contains UTF-8 JSON files plus snapshot binaries:

- projects.json: array of policy-model projects
  ```json
  [
    {
      "project_name": "ProjectA",
      "workspace": "Workspace1",
      "from_project_name": "SourceProj",                 // optional
      "from_project_version_number": 3                   // optional
    }
  ]
  ```

- project_versions.json: array of policy-model project versions. Fields include:
  - project_name
  - project_version_number
  - user_name
  - opa_version
  - description
  - creation_date (ISO-8601)
  - description_updated (optional ISO-8601)
  - description_author (optional)
  - fingerprint_sha256 (SHA-256 of snapshot content)
  - project_version_inclusions: array of
    - included_project_name
    - included_project_version_number
    - inclusion_override_count
  - project_version_changes: array of
    - object_name
    - change_type: "add" | "delete" | "modify"
  - project_decision_refs: array of decision refs (exported; currently ignored during import)

  Example:
  ```json
  [
    {
      "project_name": "ProjectA",
      "project_version_number": 1,
      "user_name": "user1",
      "opa_version": "12.2.39",
      "description": "Initial",
      "creation_date": "2024-01-01T00:00:00+00:00",
      "fingerprint_sha256": "abc123...",
      "project_version_inclusions": [
        { "included_project_name": "Common", "included_project_version_number": 5, "inclusion_override_count": 2 }
      ],
      "project_version_changes": [
        { "object_name": "rule1", "change_type": "add" }
      ],
      "project_decision_refs": [
        { "decision_service_ref": "DecisionA", "project_version_id": 123 }
      ]
    }
  ]
  ```

- modules.json: array of decision service projects (modules)
  ```json
  [
    {
      "module_name": "DecisionA",
      "module_kind": 0,                  // integer; informational
      "workspace": "Workspace2",
      "from_module_name": "SourceMod",   // optional
      "from_version_number": 7           // optional
    }
  ]
  ```

- module_versions.json: array of decision service project versions. Fields include:
  - module_name
  - version_number (0 indicates draft in import semantics)
  - create_timestamp (ISO-8601)
  - user_name
  - fingerprint_sha256
  - definition (stringified JSON definition)
  - module_imported (int)
  - description / description_updated / description_author (optional)

  Example:
  ```json
  [
    {
      "module_name": "DecisionA",
      "version_number": 1,
      "create_timestamp": "2024-02-01T00:00:00+00:00",
      "user_name": "user2",
      "fingerprint_sha256": "defhash...",
      "definition": "{\"dsl\":\"ok\"}",
      "module_imported": 0
    }
  ]
  ```

- Snapshot binary files:
  - One entry per unique `fingerprint_sha256` referenced by project versions
  - The entry name is exactly the hash value
  - Content is the decoded binary of the concatenated base64 slices from the database


## Import journal format (resume)

The journal is JSON Lines (one JSON object per line), flushed and fsync’d for safety:

- First line (header):
  ```json
  {
    "payload_sha256": "<hex-sha256-of-payload-zip>",
    "hub_url": "https://ia.example.com"
  }
  ```

- Subsequent lines (one per successful upload), e.g.:
  - Policy-model project version:
    ```json
    { "index": 0, "project_name": "ProjectA", "version_number": 1, "type": "policy-model", "sha256": "abc123..." }
    ```
  - Decision service project version:
    ```json
    { "index": 1, "project_name": "DecisionA", "version_number": 1, "type": "decision", "sha256": "defhash..." }
    ```

To resume, pass the journal file path as the optional 4th argument to `--import`. The tool will validate the header matches the payload and hub, then verify the IA Hub contains the previously imported versions before proceeding.


## Endpoints and API versions

The tool calls the following IA Hub endpoints:

- OAuth (client credentials):
  - POST: `/opa-hub/api/12.2.39/auth`
- Workspace listing:
  - GET: `/opa-hub/api/12.2.39/workspaces?links=none&fields=name`
- Existing projects with versions:
  - GET: `/opa-hub/api/12.2.39/projects?expand=versions`
- Migration (experimental):
  - POST: `/opa-hub/api/experimental/migrate-opm-project-version`
  - POST: `/opa-hub/api/experimental/migrate-decision-service-project-version`


## Examples

- Export from MySQL:
  ```bash
  java -jar build/libs/project-migrator-tool.jar \
    --export "jdbc:mysql://dbhost:3306/opadb?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
  # Prompts: Database username / Database password
  # Output: export-<millis>.zip
  ```

- Export from Oracle:
  ```bash
  java -jar build/libs/project-migrator-tool.jar \
    --export "jdbc:oracle:thin:@//dbhost:1521/ORCLPDB1"
  ```

- Import to IA Hub:
  ```bash
  java -jar build/libs/project-migrator-tool.jar \
    --import https://ia.example.com ./export-1759304200405.zip
  # Prompts: API client identifier / API client secret
  ```

- Resume an interrupted import:
  ```bash
  java -jar build/libs/project-migrator-tool.jar \
    --import https://ia.example.com ./export-1759304200405.zip ./import-1759305555555.json
  ```


## Troubleshooting

- JDBC driver not found:
  - Error: “JDBC Driver not found for URL: …”
  - The fat jar includes MySQL and Oracle drivers. Ensure you are running the built fat jar from `build/libs/` and that the JDBC URL scheme is correct.

- Database connection failed:
  - Error: “Failed to connect to the database: …”
  - Verify network, credentials, and JDBC URL.

- Name clashes on IA Hub:
  - Error: “Projects with the following names already exist on the IA Hub: …”
  - Rename or remove conflicting projects on the Hub, or import into a different environment/workspace.

- Missing workspaces:
  - Error: “Target hub is missing workspaces: …”
  - Create the required workspaces on the IA Hub, then retry.

- OAuth errors:
  - Error: “Authentication failed. HTTP code: <code>”
  - Or: “Authentication succeeded but access_token not found”
  - Verify client id/secret and the Hub URL. Note that the tool posts to `/opa-hub/api/12.2.39/auth`.

- HTTP upload failures:
  - Error includes the HTTP code and response body. Check that your client has sufficient permissions and that the IA Hub supports the experimental migration endpoints.

- Snapshot not found in zip:
  - Error: “Snapshot file not found in zip: <fingerprint>”
  - Ensure the payload zip was produced by this tool and not modified.

- Resume validation errors:
  - “Journal file does not match payload”
  - “Journal file does not match specified IA Hub”
  - Ensure the correct journal file is provided for the payload and target Hub.


## Development and Testing

- Run tests:
  ```bash
  ./gradlew test
  ```
  Test report:
  ```
  build/reports/tests/test/index.html
  ```

- Project structure highlights:
  - CLI entrypoint: `com.oracle.determinations.migration.Main`
  - Export logic: `Exporter`
  - Import logic + HTTP: `Importer`
  - Resume log: `Journal`
  - Data models: `OPMProject`, `OPMProjectVersion`, `DecisionServiceProject`, `DecisionServiceProjectVersion`, `ProjectVersion`
  - Unit tests: `src/test/java/com/oracle/determinations/migration/ImportTest.java`


## Limitations and Notes

- Supported databases: MySQL and Oracle (based on JDBC URL scheme)
- The migration endpoints under `/opa-hub/api/experimental/*` are subject to change
- Decision project `module_kind` is exported but currently informational for import
- Only unique snapshots by fingerprint are written to the export zip
- For OPM initial versions, optional cloning fields (`from_project_name`, `from_project_version_number`) are only sent on version 1
- Password prompts are masked when a system console is available; otherwise fall back to visible input
