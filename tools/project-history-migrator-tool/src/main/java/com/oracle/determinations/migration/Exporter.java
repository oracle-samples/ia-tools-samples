package com.oracle.determinations.migration;

import java.sql.*;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Base64;

import java.util.Calendar;
import java.util.TimeZone;

import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Exports projects, decision service projects, versions, and snapshots from the database into a zip.
 */
public class Exporter {

    private Set<String> exportedSnapshotIds;

    private final ZoneId zoneId;
    private final Calendar tzCalendar;

    public Exporter() {
        this(ZoneId.systemDefault());
    }

    public Exporter(ZoneId zoneId) {
        this.zoneId = (zoneId != null) ? zoneId : ZoneId.systemDefault();
        this.tzCalendar = Calendar.getInstance(TimeZone.getTimeZone(this.zoneId));
    }

    /**
     * Establishes a JDBC connection.
     * @param dbUrl JDBC URL (supports jdbc:mysql: and jdbc:oracle:).
     * @param username DB username.
     * @param password DB password.
     * @return open JDBC connection.
     * @throws SQLException on connection errors.
     * @throws ClassNotFoundException if the JDBC driver class is not found.
     */
    public Connection establishConnection(String dbUrl, String username, String password) throws SQLException, ClassNotFoundException {
        String urlLower = dbUrl == null ? "" : dbUrl.toLowerCase();
        if (urlLower.startsWith("jdbc:mysql:")) {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } else if (urlLower.startsWith("jdbc:oracle:")) {
            Class.forName("oracle.jdbc.OracleDriver");
        } else {
            throw new IllegalArgumentException("Unrecognized JDBC URL scheme: " + dbUrl + ". Supported schemes are jdbc:mysql: and jdbc:oracle:");
        }
        return DriverManager.getConnection(dbUrl, username, password);
    }

    /**
     * Performs the export and writes JSON files and snapshots to the zip.
     * @param connection JDBC connection to read from.
     * @param zos target zip stream to write entries into.
     * @throws RuntimeException if any step fails (wraps underlying exceptions).
     */
    public void doExport(Connection connection, ZipOutputStream zos) {
        exportedSnapshotIds = new HashSet<>();
        try {
            String exportedProjects = exportProjects(connection);
            addZipEntry(zos, exportedProjects, "projects.json");
            String exportedProjectVersions = exportProjectVersions(connection, zos);
            addZipEntry(zos, exportedProjectVersions, "project_versions.json");

            // Export decision service projects and versions
            String exportedDecisionServiceProjects = exportDecisionServiceProjects(connection);
            addZipEntry(zos, exportedDecisionServiceProjects, "modules.json");
            String exportedDecisionServiceProjectVersions = exportDecisionServiceProjectVersions(connection);
            addZipEntry(zos, exportedDecisionServiceProjectVersions, "module_versions.json");

        } catch (Exception ex) {
            throw new RuntimeException(ex.getMessage(), ex);
        }
    }

    /**
     * Generates a timestamped export zip filename.
     * @return file name for the export zip.
     */
    protected String newExportZipFileName() {
        return "export-" + System.currentTimeMillis() + ".zip";
    }

    /**
     * Formats a SQL timestamp to ISO-8601 with zone offset.
     * @param timestamp SQL timestamp (nullable).
     * @return formatted timestamp or null.
     */
    private String formatTimestamp(Timestamp timestamp) {
        if (timestamp == null) {
            return null;
        }
        Instant instant = timestamp.toInstant();
        ZoneId zoneId = this.zoneId;
        ZonedDateTime zdt = ZonedDateTime.ofInstant(instant, zoneId);
        return zdt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    // Returns project versions JSON, each with three child arrays for inclusions, changes, and decision refs
    /**
     * Exports project versions with inclusions, changes, and decision refs.
     * @param connection JDBC connection.
     * @param zos zip output stream (used to add snapshot binaries).
     * @return JSON array string of project versions.
     * @throws Exception on SQL or zip I/O errors.
     */
    private String exportProjectVersions(Connection connection, ZipOutputStream zos) throws Exception {
        JSONArray versions = new JSONArray();
        String versionSql = "SELECT pv.project_version_id, p.project_id, p.project_name, pv.project_version, pv.project_snapshot_id, pv.version_uuid, pv.activatable, pv.user_name,\n"
                + "pv.opa_version, pv.description, pv.creation_date, pv.deleted_timestamp, pv.project_inclusions, pv.description_updated,\n"
                + "pv.description_author, pv.runtime_dependency_ref_type FROM PROJECT_VERSION pv, PROJECT p WHERE p.project_id = pv.project_id AND pv.deleted_timestamp IS NULL ORDER BY pv.project_version_id ASC";
        try (
                Statement versionStmt = connection.createStatement();
                ResultSet versionRs = versionStmt.executeQuery(versionSql)
        ) {
            while (versionRs.next()) {
                JSONObject versionJson = new JSONObject();
                int projectVersionId = versionRs.getInt(1);
                int projectSnapshotId = versionRs.getInt(5);

                String projectName = versionRs.getString(3);
                int projectVersionNumber = versionRs.getInt(4);
                System.out.println("Exporting project version: " + projectName + " (version " + projectVersionNumber + ")");

                // Serialize all columns of PROJECT_VERSION
                versionJson.put("project_name", projectName);
                versionJson.put("project_version_number", projectVersionNumber);
                versionJson.put("user_name", versionRs.getString(8));
                versionJson.put("opa_version", versionRs.getString(9));
                versionJson.put("description", versionRs.getString(10));
                versionJson.put("creation_date", formatTimestamp(versionRs.getTimestamp(11, tzCalendar)));
                versionJson.put("description_updated", formatTimestamp(versionRs.getTimestamp(14, tzCalendar)));
                versionJson.put("description_author", versionRs.getString(15));

                // CHILD ARRAY 1: PROJECT_VERSION_INCLUSION
                JSONArray inclusions = new JSONArray();
                String inclSql = "SELECT (SELECT p.project_name FROM PROJECT p, PROJECT_VERSION pv WHERE PROJECT_VERSION_INCLUSION.included_version_id = pv.project_version_id AND p.project_id = pv.project_id) AS included_project_name,\n" +
                        "(SELECT project_version FROM PROJECT_VERSION pv WHERE PROJECT_VERSION_INCLUSION.included_version_id = pv.project_version_id) AS included_project_version_number \n" +
                        "FROM PROJECT_VERSION_INCLUSION WHERE project_version_id = ?";
                try (java.sql.PreparedStatement ps = connection.prepareStatement(inclSql)) {
                    ps.setInt(1, projectVersionId);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            JSONObject incl = new JSONObject();
                            incl.put("included_project_name", rs.getString("included_project_name"));
                            incl.put("included_project_version_number", rs.getString("included_project_version_number"));
                            inclusions.put(incl);
                        }
                    }
                }
                versionJson.put("project_version_inclusions", inclusions);

                // CHILD ARRAY 2: PROJECT_VERSION_CHANGE
                JSONArray changes = new JSONArray();
                String changeSql = "SELECT object_name, change_type FROM PROJECT_VERSION_CHANGE WHERE project_version_id = ?";
                try (java.sql.PreparedStatement ps = connection.prepareStatement(changeSql)) {
                    ps.setInt(1, projectVersionId);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            JSONObject change = new JSONObject();
                            change.put("object_name", rs.getString("object_name"));

                            int changeType = rs.getInt("change_type");

                            switch (changeType) {
                                case 0:
                                    change.put("change_type", "add");
                                    break;
                                case 1:
                                    change.put("change_type", "delete");
                                    break;
                                case 2:
                                    change.put("change_type", "modify");
                                    break;
                                default:
                                    throw new IllegalStateException("Unexpected change type: " + changeType);
                            }

                            changes.put(change);
                        }
                    }
                }
                versionJson.put("project_version_changes", changes);

                // CHILD ARRAY 3: PROJECT_DECISION_REFS
                JSONArray decisionRefs = new JSONArray();
                String refsSql = "SELECT * FROM PROJECT_DECISION_REFS WHERE project_version_id = ?";
                try (java.sql.PreparedStatement ps = connection.prepareStatement(refsSql)) {
                    ps.setInt(1, projectVersionId);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            JSONObject ref = new JSONObject();
                            ref.put("decision_service_ref", rs.getString("decision_service_ref"));
                            ref.put("project_version_id", rs.getInt("project_version_id"));
                            decisionRefs.put(ref);
                        }
                    }
                }
                versionJson.put("project_decision_refs", decisionRefs);

                //SNAPSHOT
                String fingerprintSha256 = null;
                String snapshotSql = "SELECT fingerprint_sha256, uploaded_date FROM SNAPSHOT WHERE snapshot_id = ?";
                try (java.sql.PreparedStatement ps = connection.prepareStatement(snapshotSql)) {
                    ps.setInt(1, projectSnapshotId);

                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            fingerprintSha256 = rs.getString("fingerprint_sha256");
                        }
                    }
                }
                versionJson.put("fingerprint_sha256", fingerprintSha256);

                if (fingerprintSha256 != null && !exportedSnapshotIds.contains(fingerprintSha256)) {
                    exportProjectSnapshot(connection, projectSnapshotId, fingerprintSha256, zos);
                    exportedSnapshotIds.add(fingerprintSha256);
                }

                versions.put(versionJson);
            }
        }
        return versions.toString();
    }


    /**
     * Exports all projects as projects.json content.
     * @param connection JDBC connection.
     * @return JSON array string of projects.
     * @throws SQLException on query errors.
     */
    private String exportProjects(Connection connection) throws SQLException {
        JSONArray jsonArray = new JSONArray();
        String sql = "SELECT project_name,"
                + " (SELECT p.project_name FROM PROJECT p, PROJECT_VERSION pv WHERE PROJECT.from_project_version_id = pv.project_version_id AND p.project_id = pv.project_id) AS from_project_name,"
                + " (SELECT pv.project_version FROM PROJECT_VERSION pv WHERE PROJECT.from_project_version_id = pv.project_version_id) AS from_project_version_number,"
                + " (SELECT collection_name FROM COLLECTION WHERE collection_id IN (SELECT collection_id FROM PROJECT_COLL WHERE project_id = PROJECT.project_id)) as workspace"
                + " FROM PROJECT WHERE deleted_timestamp IS NULL ORDER BY project_id ASC";
        Statement stmt = connection.createStatement();
        ResultSet rs = stmt.executeQuery(sql);
        while (rs.next()) {
            JSONObject jo = new JSONObject();
            String projectName = rs.getString("project_name");
            System.out.println("Exporting project: " + projectName);
            jo.put("project_name", projectName);
            jo.put("from_project_name", rs.getObject("from_project_name"));
            jo.put("from_project_version_number", rs.getObject("from_project_version_number"));
            jo.put("workspace", rs.getObject("workspace"));
            jsonArray.put(jo);
        }
        return jsonArray.toString();
    }

    // Export all decision service projects as modules.json
    /**
     * Exports decision service projects as modules.json content.
     * @param connection JDBC connection.
     * @return JSON array string of decision service projects.
     * @throws SQLException on query errors.
     */
    private String exportDecisionServiceProjects(Connection connection) throws SQLException {
        JSONArray jsonArray = new JSONArray();
        String sql = "SELECT m.module_id, m.module_name, m.module_kind," +
                "(SELECT module_name FROM MODULE WHERE module_id = mv.module_id) AS from_module_name," +
                "mv.version_number AS from_version_number " +
                "FROM MODULE m " +
                "LEFT JOIN MODULE_VERSION mv ON m.module_from_version_id = mv.module_version_id ORDER BY m.module_id ASC";
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                JSONObject jo = new JSONObject();
                int moduleId = rs.getInt("module_id");
                String moduleName = rs.getString("module_name");
                System.out.println("Exporting decision service project: " + moduleName);
                jo.put("module_name", moduleName);
                jo.put("module_kind", rs.getInt("module_kind"));

                // Optionally, add source module/version info if present
                String fromModuleName = rs.getString("from_module_name");
                if (!rs.wasNull()) {
                    jo.put("from_module_name", fromModuleName);
                }
                int fromVersionNumber = rs.getInt("from_version_number");
                if (!rs.wasNull()) {
                    jo.put("from_version_number", fromVersionNumber);
                }

                // Add collections ("workspaces") for this module
                String collSql = "SELECT c.collection_name FROM MODULE_COLL mc, COLLECTION c WHERE mc.collection_id = c.collection_id AND mc.module_id = ?";
                try (PreparedStatement ps = connection.prepareStatement(collSql)) {
                    ps.setInt(1, moduleId);
                    try (ResultSet collRs = ps.executeQuery()) {
                        while (collRs.next()) {
                            jo.put("workspace", collRs.getString("collection_name"));
                        }
                    }
                }

                jsonArray.put(jo);
            }
        }
        return jsonArray.toString();
    }

    // Export all decision service project versions as module_versions.json
    /**
     * Exports decision service project versions as module_versions.json content.
     * @param connection JDBC connection.
     * @return JSON array string of decision service project versions.
     * @throws SQLException on query errors.
     */
    private String exportDecisionServiceProjectVersions(Connection connection) throws SQLException {
        JSONArray jsonArray = new JSONArray();
        String sql = "SELECT mv.module_version_id, mv.module_id, m.module_name, mv.version_number, mv.format_version, mv.create_timestamp, mv.user_name, " +
                "mv.fingerprint_sha256, mv.definition, mv.module_imported, mv.description, mv.description_updated, mv.description_author " +
                "FROM MODULE_VERSION mv JOIN MODULE m ON mv.module_id = m.module_id ORDER BY mv.module_version_id ASC";
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                JSONObject jo = new JSONObject();

                String moduleName = rs.getString("module_name");
                int versionNumber = rs.getInt("version_number");
                System.out.println("Exporting decision service project version: " + moduleName + (versionNumber == 0 ? " (draft)" : " (version " + versionNumber + ")"));

                jo.put("module_name", moduleName);
                jo.put("version_number", versionNumber);
                jo.put("create_timestamp", formatTimestamp(rs.getTimestamp("create_timestamp", tzCalendar)));
                jo.put("user_name", rs.getString("user_name"));
                jo.put("fingerprint_sha256", rs.getString("fingerprint_sha256"));
                jo.put("definition", rs.getString("definition")); 
                jo.put("module_imported", rs.getInt("module_imported"));
                jo.put("description", rs.getString("description"));
                jo.put("description_updated", formatTimestamp(rs.getTimestamp("description_updated", tzCalendar)));
                jo.put("description_author", rs.getString("description_author"));

                jsonArray.put(jo);
            }
        }
        return jsonArray.toString();
    }

    /**
     * Adds a UTF-8 text file entry with content to the zip archive.
     * @param zos target zip stream.
     * @param content file contents (UTF-8).
     * @param fileName entry name.
     * @throws RuntimeException if the entry cannot be written.
     */
    private void addZipEntry(ZipOutputStream zos, String content, String fileName) {
        try {
            ZipEntry entry = new ZipEntry(fileName);
            zos.putNextEntry(entry);
            byte[] data = content.getBytes("UTF-8");
            zos.write(data, 0, data.length);
            zos.closeEntry();
        } catch (IOException e) {
            throw new RuntimeException("Failed to add zip entry '" + fileName + "': " + e.getMessage(), e);
        }
    }

    // Exports a project snapshot by fetching and decoding chunk slices, then writing to zip with given fingerprint as filename
    /**
     * Writes the decoded snapshot content to the zip using the fingerprint as the filename.
     * @param connection JDBC connection.
     * @param snapshotId snapshot identifier.
     * @param sha256Fingerprint filename to use in the zip.
     * @param zos target zip stream.
     * @throws Exception on SQL or zip I/O errors.
     */
    private void exportProjectSnapshot(Connection connection, int snapshotId, String sha256Fingerprint, ZipOutputStream zos) throws Exception {
        String sql = "SELECT chunk_slice FROM SNAPSHOT_CHUNK WHERE snapshot_id = ? ORDER BY chunk_sequence ASC";
        StringBuilder b64Concat = new StringBuilder();
        try (java.sql.PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setInt(1, snapshotId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    b64Concat.append(rs.getString("chunk_slice"));
                }
            }
        }
        if (b64Concat.length() == 0) {
            throw new IOException("No snapshot chunks found for snapshot_id " + snapshotId);
        }
        // Decode base64

        byte[] content = Base64.getDecoder().decode(b64Concat.toString());
        ZipEntry entry = new ZipEntry(sha256Fingerprint);
        zos.putNextEntry(entry);
        zos.write(content, 0, content.length);
        zos.closeEntry();
    }

    
}
