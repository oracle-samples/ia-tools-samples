package com.oracle.determinations.migration;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

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
    public final Map<String, Integer> inclusionOverrideCounts;
    public final Map<String, String> changes;

    public OPMProjectVersion(String projectName,
                          int projectVersionNumber,
                          String description,
                          String userName,
                          String opaVersion,
                          String creationDate,
                          String descriptionUpdated,
                          String descriptionAuthor,
                          String fingerprintSha256,
                          Map<String, Integer> inclusionOverrideCounts,
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
        this.inclusionOverrideCounts = inclusionOverrideCounts != null ? inclusionOverrideCounts : new HashMap<>();
        this.changes = changes != null ? changes : new HashMap<>();
    }

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

        return new OPMProjectVersion(projectName, versionNumber, description, userName, opaVersion, creationDate,
                descriptionUpdated, descriptionAuthor, fingerprint, inclusionOverrideCounts, changes);
    }


    public JSONObject toJSONForJournal(int index) {
        JSONObject obj = new JSONObject();
        obj.put("index", index);
        obj.put("project_name", projectName);
        obj.put("version_number", projectVersionNumber);
        obj.put("type", "policy-model");
        obj.put("sha256", fingerprintSha256);
        return obj;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof OPMProjectVersion)) return false;
        OPMProjectVersion that = (OPMProjectVersion) o;
        return projectVersionNumber == that.projectVersionNumber
                && Objects.equals(projectName, that.projectName)
                && Objects.equals(description, that.description)
                && Objects.equals(userName, that.userName)
                //&& Objects.equals(creationDate, that.creationDate) TODO fix date comparison
                //&& Objects.equals(descriptionUpdated, that.descriptionUpdated) TODO fix date comparison
                && Objects.equals(descriptionAuthor, that.descriptionAuthor)
                && Objects.equals(fingerprintSha256, that.fingerprintSha256);
    }

    @Override
    public int hashCode() {
        return Objects.hash(projectName, projectVersionNumber, description, userName, creationDate, descriptionUpdated, descriptionAuthor, fingerprintSha256);
    }

    @Override
    public int getVersion() {
        return projectVersionNumber;
    }

    @Override
    public String getProjectName() {
        return projectName;
    }

    @Override
    public boolean isDraft() {
        // No drafts for OPM projects
        return false;
    }
}
