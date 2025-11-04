package com.oracle.determinations.migration;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Represents an OPM project version with metadata, inclusion overrides, and changes.
 */
public class OPMProjectVersion implements ProjectVersion {
    public final String projectName;
    public final int projectVersionNumber;
    public final String description;
    public final String userName;
    public final String opaVersion;
    public final String creationDate;
    public final String descriptionUpdated;
    public final String descriptionAuthor;
    public final String fingerprintSha256;
    public final Map<String, String> changes;

    /**
     * Constructs an OPMProjectVersion.
     * @param projectName Project name.
     * @param projectVersionNumber Version number.
     * @param description Version description.
     * @param userName Author of the version.
     * @param opaVersion OPA version string.
     * @param creationDate Creation timestamp.
     * @param descriptionUpdated When the description was last updated.
     * @param descriptionAuthor Who last updated the description.
     * @param fingerprintSha256 Snapshot fingerprint hash.
     * @param changes Object-level change map for the version.
     */
    public OPMProjectVersion(String projectName,
                          int projectVersionNumber,
                          String description,
                          String userName,
                          String opaVersion,
                          String creationDate,
                          String descriptionUpdated,
                          String descriptionAuthor,
                          String fingerprintSha256,
                          Map<String, String> changes) {
        this.projectName = projectName;
        this.projectVersionNumber = projectVersionNumber;
        this.description = description;
        this.userName = userName;
        this.opaVersion = opaVersion;
        this.creationDate = creationDate;
        this.descriptionUpdated = descriptionUpdated;
        this.descriptionAuthor = descriptionAuthor;
        this.fingerprintSha256 = fingerprintSha256;
        this.changes = changes != null ? changes : new HashMap<>();
    }

    /**
     * Builds an OPMProjectVersion from JSON.
     * @param obj JSON with keys: project_name, project_version_number, description, user_name, opa_version, creation_date, optional description_updated, description_author, fingerprint_sha256, project_version_inclusions, project_version_changes.
     * @return parsed OPMProjectVersion.
     * @throws org.json.JSONException if required fields are missing or invalid.
     */
    public static OPMProjectVersion fromJson(JSONObject obj) {
        String projectName = obj.getString("project_name");
        int versionNumber = obj.getInt("project_version_number");
        String description = obj.getString("description");
        String userName = obj.getString("user_name");
        String opaVersion = obj.getString("opa_version");
        String creationDate = obj.getString("creation_date");
        String descriptionUpdated = obj.has("description_updated") ? obj.getString("description_updated") : null;
        String descriptionAuthor = obj.has("description_author") ? obj.getString("description_author") : null;
        String fingerprint = obj.getString("fingerprint_sha256");

        Map<String, String> changes = new HashMap<>();
        if (obj.has("project_version_changes")) {
            JSONArray chArr = obj.getJSONArray("project_version_changes");
            for (int j = 0; j < chArr.length(); j++) {
                JSONObject ch = chArr.getJSONObject(j);
                changes.put(ch.getString("object_name"), ch.getString("change_type"));
            }
        }

        return new OPMProjectVersion(projectName, versionNumber, description, userName, opaVersion, creationDate,
                descriptionUpdated, descriptionAuthor, fingerprint, changes);
    }


    /**
     * Serializes fields needed for the import journal.
     * @param index sequential index for the journal entry.
     * @return JSON entry for the journal.
     */
    public JSONObject toJSONForJournal(int index) {
        JSONObject obj = new JSONObject();
        obj.put("index", index);
        obj.put("project_name", projectName);
        obj.put("version_number", projectVersionNumber);
        obj.put("type", "policy-model");
        obj.put("sha256", fingerprintSha256);
        return obj;
    }

    /**
     * Value equality based on key fields.
     */
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof OPMProjectVersion)) return false;
        OPMProjectVersion that = (OPMProjectVersion) o;
        return projectVersionNumber == that.projectVersionNumber
                && Objects.equals(projectName, that.projectName)
                && Objects.equals(description, that.description)
                && Objects.equals(userName, that.userName)
                && DateTimeUtil.sameInstant(creationDate, that.creationDate)
                && DateTimeUtil.sameInstant(descriptionUpdated, that.descriptionUpdated)
                && Objects.equals(descriptionAuthor, that.descriptionAuthor)
                && Objects.equals(fingerprintSha256, that.fingerprintSha256);
    }

    /**
     * Hash code consistent with equals.
     */
    @Override
    public int hashCode() {
        return Objects.hash(projectName, projectVersionNumber, description, userName,
                DateTimeUtil.instantOrNull(creationDate),
                DateTimeUtil.instantOrNull(descriptionUpdated),
                descriptionAuthor, fingerprintSha256);
    }

    /**
     * Returns the version number.
     */
    @Override
    public int getVersion() {
        return projectVersionNumber;
    }

    /**
     * Returns the project name.
     */
    @Override
    public String getProjectName() {
        return projectName;
    }

    /**
     * OPM projects do not support draft versions.
     */
    @Override
    public boolean isDraft() {
        // No drafts for OPM projects
        return false;
    }
}
