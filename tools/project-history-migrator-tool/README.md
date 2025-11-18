# Project History Migrator Tool
This is a CLI utility that allows the migration of the full project version history from a self-managed instance of Intelligent Advisor to a cloud instance. The tool migrates the project version history for both Policy Modeling projects and Decision Service projects.

## Prerequisites
### System requirements
- The tool must be run on a machine that has the Java 8 Runtime Environment (JRE) or newer installed
- For running in export mode - network access (JDBC) to the database associated with your self-managed Intelligent Advisor installation is required
- For running in import mode - network access (HTTP) to the Intelligent Advisor cloud instance is required 

### Pre-migration setup
Before beginning the migration process for the project history, the following steps must be taken:
- Migrate users to the cloud instance using the [Users REST API](https://docs.oracle.com/en/cloud/saas/b2c-service/opawx/using-users-rest-api.html), or by creating manually
- Migrate workspaces to the cloud instance using the [Workspaces REST API](https://docs.oracle.com/en/cloud/saas/b2c-service/opawx/using-workspaces-rest-api.html), or by creating manually
- Migrate connections to the cloud instance using the [Connections REST API](https://docs.oracle.com/en/cloud/saas/b2c-service/opawx/using-connections-rest-api.html), or by creating manually
- On the cloud instance, create an API client to use for importing project history. This API client must have both the **manager** and **author** roles for **all workspaces**

## Pre-built binary
TODO - when QA is complete a built version of the tool will be uploaded to GitHub and linked here.

## Build from source
The tool can be built from source using the Gradle wrapper:

```bash
# macOS/Linux
./gradlew clean build

# Windows (PowerShell/CMD)
gradlew.bat clean build
```

The JAR will be created under `build/libs/`. It is named after the project directory:
```
build/libs/project-history-migrator-tool.jar
```

## Usage
### Export mode
Usage:
```bash
java -jar project-history-migrator-tool.jar --export <dbUrl> [timeZoneId]
```
Parameters:
- `dbUrl`: JDBC URL that references the MySQL or Oracle database associated with your self-managed Intelligent Advisor installation. Examples `jdbc:mysql://hostname:3306/schema_name`, `jdbc:oracle:thin:@//hostname:1521/PDBNAME`
- `timeZoneId` (optional): Sets the time zone for interpreting and formatting timestamps values read from the database. Examples: 'UTC', 'Europe/London', '+10:00'. Defaults to system time zone. See Java 8 Javadoc ZoneId.of(String): <https://docs.oracle.com/javase/8/docs/api/java/time/ZoneId.html#of-java.lang.String->

Output:
A zip archive containing the exported data, with filename `export-<timestamp>.zip`

### Import mode (with resume)
Usage:
```bash
java -jar project-history-migrator-tool.jar --import <IAHostUrl> <exportedPayloadPath> [resumeJournalPath]
```

Parameters:
- `<IAHostUrl>`: Base host URL of the Intelligent Advisor site, e.g. `https://name.custhelp.com` 
- `<exportedPayloadPath>`: Path to the exported zip created by this tool
- `[resumeJournalPath]` (optional): Path to a previously written journal file used to resume a previous failed import of project history

Output:
A journal file in JSON format, with filename `import-<timestamp>.json`. In the event of a failure part way through the import process, the journal file can be used to resume the process. To resume, pass the path to this file as the "resumeJournalPath" parameter.

## Troubleshooting
- Database connection failed:
  - Error: "Failed to connect to the database: ..."
  - Verify network, credentials, and JDBC URL.

- Name clashes on IA Hub:
  - Error: "Projects with the following names already exist on the IA Hub: ..."
  - Rename or remove conflicting projects on the Hub, or import into a different environment/workspace.

- Missing workspaces:
  - Error: "Target hub is missing workspaces: ..."
  - Create the required workspaces on the IA Hub, then retry.

- OAuth errors:
  - Error: "Authentication failed. HTTP code: <code>"
  - Or: "Authentication succeeded but access_token not found"
  - Verify client id/secret and the Hub URL.

- HTTP upload failures:
  - Error includes the HTTP code and response body. Check that your client has sufficient permissions.

- Snapshot not found in zip:
  - Error: "Snapshot file not found in zip: <fingerprint>"
  - Ensure the payload zip was produced by this tool and not modified.

- Resume validation errors:
  - "Journal file does not match payload"
  - "Journal file does not match specified IA Hub"
  - Ensure the correct journal file is provided for the payload and target Hub.
