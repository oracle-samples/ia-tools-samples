package com.oracle.determinations.migration;

import java.sql.*;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Base64;

import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class Exporter {

    private Set<String> exportedSnapshotIds;

    public Connection establishConnection(String dbUrl, String username, String password) throws SQLException, ClassNotFoundException {
        String urlLower = dbUrl == null ? "" : dbUrl.toLowerCase();
        if (urlLower.startsWith("jdbc:mysql:")) {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } else if (urlLower.startsWith("jdbc:oracle:")) {
            Class.forName("oracle.jdbc.OracleDriver");
        } else {
            System.out.println("Unrecognized JDBC URL scheme: " + dbUrl + ". Attempting to connect without explicit driver load.");
        }
        return DriverManager.getConnection(dbUrl, username, password);
    }

    public void doExport(Connection connection, ZipOutputStream zos) {
        exportedSnapshotIds = new HashSet<>();
        try {
            String exportedProjects = exportProjects(connection);
            addZipEntry(zos, exportedProjects, "projects.json");
            String exportedProjectVersions = exportProjectVersions(connection, zos);
            addZipEntry(zos, exportedProjectVersions, "project_versions.json");

            // Export modules and module versions
            String exportedModules = exportModules(connection);
            addZipEntry(zos, exportedModules, "modules.json");
            String exportedModuleVersions = exportModuleVersions(connection);
            addZipEntry(zos, exportedModuleVersions, "module_versions.json");

        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    private String formatTimestamp(Timestamp timestamp) {
        if (timestamp == null) {
            return null;
        }
        Instant instant = timestamp.toInstant();
        ZoneId zoneId = ZoneId.systemDefault();
        ZonedDateTime zdt = ZonedDateTime.ofInstant(instant, zoneId);
        return zdt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    // Returns project versions JSON, each with three child arrays for inclusions, changes, and decision refs
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
                int projectId = versionRs.getInt(2);
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
                versionJson.put("creation_date", formatTimestamp(versionRs.getTimestamp(11)));
                versionJson.put("description_updated", formatTimestamp(versionRs.getTimestamp(14)));
                versionJson.put("description_author", versionRs.getString(15));

                // CHILD ARRAY 1: PROJECT_VERSION_INCLUSION
                JSONArray inclusions = new JSONArray();
                String inclSql = "SELECT (SELECT p.project_name FROM PROJECT p, PROJECT_VERSION pv WHERE PROJECT_VERSION_INCLUSION.included_version_id = pv.project_version_id AND p.project_id = pv.project_id) AS included_project_name,\n" +
                        "(SELECT project_version FROM PROJECT_VERSION pv WHERE PROJECT_VERSION_INCLUSION.included_version_id = pv.project_version_id) AS included_project_version_number,\n" +
                        "inclusion_override_count \n" +
                        "FROM PROJECT_VERSION_INCLUSION WHERE project_version_id = ?";
                try (java.sql.PreparedStatement ps = connection.prepareStatement(inclSql)) {
                    ps.setInt(1, projectVersionId);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            JSONObject incl = new JSONObject();
                            incl.put("included_project_name", rs.getString("included_project_name"));
                            incl.put("included_project_version_number", rs.getString("included_project_version_number"));
                            incl.put("inclusion_override_count", rs.getInt("inclusion_override_count"));
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
                JSONObject snapshot = new JSONObject();
                String snapshotSql = "SELECT fingerprint_sha256, uploaded_date FROM SNAPSHOT WHERE snapshot_id = ?";
                try (java.sql.PreparedStatement ps = connection.prepareStatement(snapshotSql)) {
                    ps.setInt(1, projectSnapshotId);

                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            fingerprintSha256 = rs.getString("fingerprint_sha256");
                            snapshot.put("fingerprint_sha256", fingerprintSha256);
                        }
                    }
                }
                versionJson.put("snapshot", snapshot);

                if (fingerprintSha256 != null && !exportedSnapshotIds.contains(fingerprintSha256)) {
                    exportProjectSnapshot(connection, projectSnapshotId, fingerprintSha256, zos);
                    exportedSnapshotIds.add(fingerprintSha256);
                }

                // WORKSPACE (fka Collection)
                String workspaceName = null;
                String workspaceSql = "SELECT collection_name FROM COLLECTION WHERE collection_id IN (SELECT collection_id FROM PROJECT_COLL WHERE project_id = ?)";
                try (java.sql.PreparedStatement ps = connection.prepareStatement(workspaceSql)) {
                    ps.setInt(1, projectId);

                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            workspaceName = rs.getString("collection_name");
                            versionJson.put("workspace", workspaceName);
                        }
                    }
                }

                versions.put(versionJson);
            }
        }
        return versions.toString();
    }


    private String exportProjects(Connection connection) throws SQLException {
        JSONArray jsonArray = new JSONArray();
        String sql = "SELECT project_id, project_name, project_description, last_updated,\n"
                + " (SELECT p.project_name FROM PROJECT p, PROJECT_VERSION pv WHERE PROJECT.from_project_version_id = pv.project_version_id AND p.project_id = pv.project_id) AS from_project_name,\n"
                + " (SELECT pv.project_version FROM PROJECT_VERSION pv WHERE PROJECT.from_project_version_id = pv.project_version_id) AS from_project_version_number,\n"
                + " latest_version, deleted_timestamp FROM PROJECT WHERE deleted_timestamp IS NULL";
        Statement stmt = connection.createStatement();
        ResultSet rs = stmt.executeQuery(sql);
        while (rs.next()) {
            JSONObject jo = new JSONObject();
            String projectName = rs.getString("project_name");
            System.out.println("Exporting project: " + projectName);
            jo.put("project_name", projectName);
            jo.put("project_description", rs.getString("project_description"));
            jo.put("from_project_name", rs.getObject("from_project_name"));
            jo.put("from_project_version_number", rs.getObject("from_project_version_number"));
            jsonArray.put(jo);
        }
        return jsonArray.toString();
    }

    // Export all modules as modules.json
    private String exportModules(Connection connection) throws SQLException {
        JSONArray jsonArray = new JSONArray();
        String sql = "SELECT m.module_id, m.module_name, m.module_kind, m.module_is_template, " +
                "m.module_from_version_id, mv.module_id AS from_module_id, mv.version_number AS from_version_number " +
                "FROM MODULE m " +
                "LEFT JOIN MODULE_VERSION mv ON m.module_from_version_id = mv.module_version_id";
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                JSONObject jo = new JSONObject();
                int moduleId = rs.getInt("module_id");
                String moduleName = rs.getString("module_name");
                System.out.println("Exporting module: " + moduleName);
                jo.put("module_name", moduleName);
                jo.put("module_kind", rs.getInt("module_kind"));
                jo.put("module_is_template", rs.getInt("module_is_template"));

                // Optionally, add source module/version info if present
                int fromModuleId = rs.getInt("from_module_id");
                if (!rs.wasNull()) {
                    jo.put("from_module_id", fromModuleId);
                }
                int fromVersionNumber = rs.getInt("from_version_number");
                if (!rs.wasNull()) {
                    jo.put("from_version_number", fromVersionNumber);
                }

                // Add collections ("workspaces") for this module
                JSONArray workspaces = new JSONArray();
                String collSql = "SELECT c.collection_name FROM MODULE_COLL mc, COLLECTION c WHERE mc.collection_id = c.collection_id AND mc.module_id = ?";
                try (PreparedStatement ps = connection.prepareStatement(collSql)) {
                    ps.setInt(1, moduleId);
                    try (ResultSet collRs = ps.executeQuery()) {
                        while (collRs.next()) {
                            workspaces.put(collRs.getString("collection_name"));
                        }
                    }
                }
                jo.put("workspaces", workspaces);

                jsonArray.put(jo);
            }
        }
        return jsonArray.toString();
    }

    // Export all module versions as module_versions.json
    private String exportModuleVersions(Connection connection) throws SQLException {
        JSONArray jsonArray = new JSONArray();
        String sql = "SELECT mv.module_version_id, mv.module_id, m.module_name, mv.version_number, mv.format_version, mv.create_timestamp, mv.user_name, " +
                "mv.fingerprint_sha256, mv.definition, mv.module_imported, mv.description, mv.description_updated, mv.description_author " +
                "FROM MODULE_VERSION mv JOIN MODULE m ON mv.module_id = m.module_id ORDER BY mv.module_version_id ASC";
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                JSONObject jo = new JSONObject();
                int moduleVersionId = rs.getInt("module_version_id");
                int moduleId = rs.getInt("module_id");

                String moduleName = rs.getString("module_name");
                int versionNumber = rs.getInt("version_number");
                System.out.println("Exporting module version: " + moduleName + " (version " + versionNumber + ")");

                jo.put("module_name", moduleName);
                jo.put("version_number", versionNumber);
                jo.put("create_timestamp", formatTimestamp(rs.getTimestamp("create_timestamp")));
                jo.put("user_name", rs.getString("user_name"));
                jo.put("fingerprint_sha256", rs.getString("fingerprint_sha256"));
                jo.put("definition", rs.getString("definition")); // Already JSON string
                jo.put("module_imported", rs.getInt("module_imported"));
                jo.put("description", rs.getString("description"));
                jo.put("description_updated", formatTimestamp(rs.getTimestamp("description_updated")));
                jo.put("description_author", rs.getString("description_author"));

                // Add workspaces this module appears in (from MODULE_COLL)
                JSONArray workspaces = new JSONArray();
                String collSql = "SELECT c.collection_name FROM MODULE_COLL mc, COLLECTION c WHERE mc.collection_id = c.collection_id AND mc.module_id = ?";
                try (PreparedStatement ps = connection.prepareStatement(collSql)) {
                    ps.setInt(1, moduleId);
                    try (ResultSet collRs = ps.executeQuery()) {
                        while (collRs.next()) {
                            workspaces.put(collRs.getString("collection_name"));
                        }
                    }
                }
                jo.put("workspaces", workspaces);

                jsonArray.put(jo);
            }
        }
        return jsonArray.toString();
    }

    private void addZipEntry(ZipOutputStream zos, String content, String fileName) {
        try {
            ZipEntry entry = new ZipEntry(fileName);
            zos.putNextEntry(entry);
            byte[] data = content.getBytes("UTF-8");
            zos.write(data, 0, data.length);
            zos.closeEntry();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    // Exports a project snapshot by fetching and decoding chunk slices, then writing to zip with given fingerprint as filename
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
