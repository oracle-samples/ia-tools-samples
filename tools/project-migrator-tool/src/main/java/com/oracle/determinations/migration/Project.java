package com.oracle.determinations.migration;

import org.json.JSONObject;

public class Project {
    public final String projectName;
    public final String fromProjectName;
    public final Integer fromProjectVersionNumber;

    public Project(String projectName, String fromProjectName, Integer fromProjectVersionNumber) {
        this.projectName = projectName;
        this.fromProjectName = fromProjectName;
        this.fromProjectVersionNumber = fromProjectVersionNumber;
    }

    public static Project fromJson(JSONObject obj) {
        String name = obj.getString("project_name");
        String fromName = obj.has("from_project_name") ? obj.getString("from_project_name") : null;
        Integer fromVersion = obj.has("from_project_version_number") ? obj.getInt("from_project_version_number") : null;
        return new Project(name, fromName, fromVersion);
    }
}
