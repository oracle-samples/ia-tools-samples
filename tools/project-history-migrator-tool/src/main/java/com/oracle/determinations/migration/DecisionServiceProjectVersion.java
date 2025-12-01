/**
 * Copyright © 2025, Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
package com.oracle.determinations.migration;

import org.json.JSONObject;
import java.util.Objects;

/**
 * Represents a decision service version and related metadata.
 */
public class DecisionServiceProjectVersion implements ProjectVersion {
    public final String projectName;
    public final int versionNumber;
    public final String createTimestamp;
    public final int imported;
    public final String userName;
    public final String definition;
    public final String description;
    public final String descriptionUpdated;
    public final String descriptionAuthor;
    public final String fingerprintSha256;
    public final boolean isDraft;

    /**
     * Creates a new decision service project version.
     * @param projectName decision service project name.
     * @param versionNumber version number (0 indicates draft).
     * @param createTimestamp creation timestamp.
     * @param imported import flag/counter from source DB.
     * @param userName author of the version.
     * @param definition decision service project definition content (JSON string).
     * @param description optional description.
     * @param descriptionUpdated optional description last-updated timestamp.
     * @param descriptionAuthor optional description author.
     * @param fingerprintSha256 definition fingerprint hash.
     */
    public DecisionServiceProjectVersion(String projectName,
                         int versionNumber,
                         String createTimestamp,
                         int imported,
                         String userName,
                         String definition,
                         String description,
                         String descriptionUpdated,
                         String descriptionAuthor,
                         String fingerprintSha256) {
        this.projectName = projectName;
        this.versionNumber = versionNumber;
        this.createTimestamp = createTimestamp;
        this.imported = imported;
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
    public static DecisionServiceProjectVersion fromJson(JSONObject obj) {
        String projectName = obj.getString("module_name");
        int versionNumber = obj.getInt("version_number");
        String createTimestamp = obj.getString("create_timestamp");
        int imported = obj.getInt("module_imported");
        String userName = obj.getString("user_name");
        String definition = obj.getString("definition");
        String description = obj.has("description") ? obj.getString("description") : null;
        String descriptionUpdated = obj.has("description_updated") ? obj.getString("description_updated") : null;
        String descriptionAuthor = obj.has("description_author") ? obj.getString("description_author") : null;
        String fingerprint = obj.getString("fingerprint_sha256");
        return new DecisionServiceProjectVersion(projectName, versionNumber, createTimestamp, imported, userName, definition,
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
        obj.put("project_name", projectName);
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
        if (!(o instanceof DecisionServiceProjectVersion)) return false;
        DecisionServiceProjectVersion that = (DecisionServiceProjectVersion) o;
        return versionNumber == that.versionNumber
                && Objects.equals(projectName, that.projectName)
                && DateTimeUtil.sameInstant(createTimestamp, that.createTimestamp)
                && Objects.equals(userName, that.userName)
                && Objects.equals(description, that.description)
                && DateTimeUtil.sameInstant(descriptionUpdated, that.descriptionUpdated)
                && Objects.equals(descriptionAuthor, that.descriptionAuthor)
                && Objects.equals(fingerprintSha256, that.fingerprintSha256);
    }

    /**
     * Hash code consistent with equals.
     */
    @Override
    public int hashCode() {
        return Objects.hash(projectName, versionNumber,
                DateTimeUtil.instantOrNull(createTimestamp),
                userName, definition, description,
                DateTimeUtil.instantOrNull(descriptionUpdated),
                descriptionAuthor, fingerprintSha256);
    }

    /**
     * Returns the version number.
     */
    @Override
    public int getVersion() {
        return versionNumber;
    }

    /**
     * Returns the project name.
     */
    @Override
    public String getProjectName() {
        return projectName;
    }

    /**
     * Indicates whether this version is a draft.
     */
    @Override
    public boolean isDraft() {
        return isDraft;
    }
}
