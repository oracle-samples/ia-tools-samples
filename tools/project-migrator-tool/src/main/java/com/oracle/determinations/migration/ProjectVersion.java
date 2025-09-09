package com.oracle.determinations.migration;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public class ProjectVersion {
    public final String projectName;
    public final int projectVersionNumber;
    public final String description;
    public final String userName;
    public final String opaVersion;
    public final String creationDate;
    public final String workspace;
    public final String descriptionUpdated;
    public final String descriptionAuthor;
    public final String snapshotFingerprintSha256;
    public final Map<String, Integer> inclusionOverrideCounts;
    public final Map<String, String> changes;

    public ProjectVersion(String projectName,
                          int projectVersionNumber,
                          String description,
                          String userName,
                          String opaVersion,
                          String creationDate,
                          String workspace,
                          String descriptionUpdated,
                          String descriptionAuthor,
                          String snapshotFingerprintSha256,
                          Map<String, Integer> inclusionOverrideCounts,
                          Map<String, String> changes) {
        this.projectName = projectName;
        this.projectVersionNumber = projectVersionNumber;
        this.description = description;
        this.userName = userName;
        this.opaVersion = opaVersion;
        this.creationDate = creationDate;
        this.workspace = workspace;
        this.descriptionUpdated = descriptionUpdated;
        this.descriptionAuthor = descriptionAuthor;
        this.snapshotFingerprintSha256 = snapshotFingerprintSha256;
        this.inclusionOverrideCounts = inclusionOverrideCounts != null ? inclusionOverrideCounts : new HashMap<>();
        this.changes = changes != null ? changes : new HashMap<>();
    }

    public static ProjectVersion fromJson(JSONObject obj) {
        String projectName = obj.getString("project_name");
        int versionNumber = obj.getInt("project_version_number");
        String description = obj.getString("description");
        String userName = obj.getString("user_name");
        String opaVersion = obj.getString("opa_version");
        String creationDate = obj.getString("creation_date");
        String workspace = obj.getString("workspace");
        String descriptionUpdated = obj.has("description_updated") ? obj.getString("description_updated") : null;
        String descriptionAuthor = obj.has("description_author") ? obj.getString("description_author") : null;

        String fingerprint = null;
        if (obj.has("snapshot")) {
            JSONObject snapshotObj = obj.getJSONObject("snapshot");
            if (snapshotObj.has("fingerprint_sha256")) {
                fingerprint = snapshotObj.getString("fingerprint_sha256");
            }
        }

        Map<String, Integer> inclusionOverrideCounts = new HashMap<>();
        if (obj.has("project_version_inclusions")) {
            JSONArray incArr = obj.getJSONArray("project_version_inclusions");
            for (int j = 0; j < incArr.length(); j++) {
                JSONObject inc = incArr.getJSONObject(j);
                inclusionOverrideCounts.put(inc.getString("included_project_name"), inc.getInt("inclusion_override_count"));
            }
        }

        Map<String, String> changes = new HashMap<>();
        if (obj.has("project_version_changes")) {
            JSONArray chArr = obj.getJSONArray("project_version_changes");
            for (int j = 0; j < chArr.length(); j++) {
                JSONObject ch = chArr.getJSONObject(j);
                changes.put(ch.getString("object_name"), ch.getString("change_type"));
            }
        }

        return new ProjectVersion(projectName, versionNumber, description, userName, opaVersion, creationDate, workspace,
                descriptionUpdated, descriptionAuthor, fingerprint, inclusionOverrideCounts, changes);
    }


    public JSONObject toJSON() {
        JSONObject obj = new JSONObject();
        obj.put("project_name", projectName);
        obj.put("project_version_number", projectVersionNumber);
        obj.put("opa_version", opaVersion);
        obj.put("description", description);
        obj.put("user_name", userName);
        obj.put("creation_date", creationDate);
        obj.put("workspace", workspace);
        if (descriptionUpdated != null) {
            obj.put("description_updated", descriptionUpdated);
        }
        if (descriptionAuthor != null) {
            obj.put("description_author", descriptionAuthor);
        }
        return obj;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ProjectVersion)) return false;
        ProjectVersion that = (ProjectVersion) o;
        return projectVersionNumber == that.projectVersionNumber
                && Objects.equals(projectName, that.projectName)
                && Objects.equals(description, that.description)
                && Objects.equals(userName, that.userName)
                && Objects.equals(creationDate, that.creationDate)
                && Objects.equals(workspace, that.workspace)
                && Objects.equals(descriptionUpdated, that.descriptionUpdated)
                && Objects.equals(descriptionAuthor, that.descriptionAuthor);
    }

    @Override
    public int hashCode() {
        return Objects.hash(projectName, projectVersionNumber, description, userName, creationDate, workspace, descriptionUpdated, descriptionAuthor);
    }
}
