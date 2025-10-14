package com.oracle.determinations.migration;

import org.json.JSONObject;
import java.util.Objects;

/**
 * Represents a decision service version and related metadata.
 */
public class DecisionServiceVersion implements ProjectVersion {
    public final String moduleName;
    public final int versionNumber;
    public final String createTimestamp;
    public final int moduleImported;
    public final String userName;
    public final String definition;
    public final String description;
    public final String descriptionUpdated;
    public final String descriptionAuthor;
    public final String fingerprintSha256;
    public final boolean isDraft;

    /**
     * Creates a new DecisionServiceVersion.
     * @param moduleName module name.
     * @param versionNumber version number (0 indicates draft).
     * @param createTimestamp creation timestamp.
     * @param moduleImported import flag/counter from source DB.
     * @param userName author of the version.
     * @param definition module definition content (JSON string).
     * @param description optional description.
     * @param descriptionUpdated optional description last-updated timestamp.
     * @param descriptionAuthor optional description author.
     * @param fingerprintSha256 definition fingerprint hash.
     */
    public DecisionServiceVersion(String moduleName,
                         int versionNumber,
                         String createTimestamp,
                         int moduleImported,
                         String userName,
                         String definition,
                         String description,
                         String descriptionUpdated,
                         String descriptionAuthor,
                         String fingerprintSha256) {
        this.moduleName = moduleName;
        this.versionNumber = versionNumber;
        this.createTimestamp = createTimestamp;
        this.moduleImported = moduleImported;
        this.userName = userName;
        this.definition = definition;
        this.description = description;
        this.descriptionUpdated = descriptionUpdated;
        this.descriptionAuthor = descriptionAuthor;
        this.fingerprintSha256 = fingerprintSha256;
        this.isDraft = versionNumber == 0;
    }

    /**
     * Builds an instance from a JSON object.
     * @param obj JSON with keys: module_name, version_number, create_timestamp, module_imported, user_name, definition; optional description, description_updated, description_author, fingerprint_sha256.
     * @return parsed DecisionServiceVersion.
     * @throws org.json.JSONException if required fields are missing or invalid.
     */
    public static DecisionServiceVersion fromJson(JSONObject obj) {
        String moduleName = obj.getString("module_name");
        int versionNumber = obj.getInt("version_number");
        String createTimestamp = obj.getString("create_timestamp");
        int moduleImported = obj.getInt("module_imported");
        String userName = obj.getString("user_name");
        String definition = obj.getString("definition");
        String description = obj.has("description") ? obj.getString("description") : null;
        String descriptionUpdated = obj.has("description_updated") ? obj.getString("description_updated") : null;
        String descriptionAuthor = obj.has("description_author") ? obj.getString("description_author") : null;
        String fingerprint = obj.getString("fingerprint_sha256");
        return new DecisionServiceVersion(moduleName, versionNumber, createTimestamp, moduleImported, userName, definition,
                description, descriptionUpdated, descriptionAuthor, fingerprint);
    }


    /**
     * Serializes a minimal JSON entry for the import/export journal.
     * @param index sequential index for the journal entry.
     * @return JSON object for the journal.
     */
    public JSONObject toJSONForJournal(int index) {
        JSONObject obj = new JSONObject();
        obj.put("index", index);
        obj.put("project_name", moduleName);
        obj.put("version_number", versionNumber);
        obj.put("type", "decision");
        obj.put("sha256", fingerprintSha256);
        return obj;
    }

    /**
     * Value equality based on key fields.
     */
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof DecisionServiceVersion)) return false;
        DecisionServiceVersion that = (DecisionServiceVersion) o;
        return versionNumber == that.versionNumber
                && Objects.equals(moduleName, that.moduleName)
                //&& Objects.equals(createTimestamp, that.createTimestamp)
                && Objects.equals(userName, that.userName)
                && Objects.equals(definition, that.definition)
                && Objects.equals(description, that.description)
                //&& Objects.equals(descriptionUpdated, that.descriptionUpdated)
                && Objects.equals(descriptionAuthor, that.descriptionAuthor)
                && Objects.equals(fingerprintSha256, that.fingerprintSha256);
    }

    /**
     * Hash code consistent with equals.
     */
    @Override
    public int hashCode() {
        return Objects.hash(moduleName, versionNumber, createTimestamp, userName, definition, description, descriptionUpdated, descriptionAuthor, fingerprintSha256);
    }

    /**
     * Returns the version number.
     */
    @Override
    public int getVersion() {
        return versionNumber;
    }

    /**
     * Returns the module/project name.
     */
    @Override
    public String getProjectName() {
        return moduleName;
    }

    /**
     * Indicates whether this version is a draft.
     */
    @Override
    public boolean isDraft() {
        return isDraft;
    }
}
