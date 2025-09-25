package com.oracle.determinations.migration;

import org.json.JSONObject;

public class OPMProject {
    public final String projectName;
    public final String fromProjectName;
    public final Integer fromProjectVersionNumber;
    public final String workspace;

    public OPMProject(String projectName, String workspace, String fromProjectName, Integer fromProjectVersionNumber) {
        this.projectName = projectName;
        this.workspace = workspace;
        this.fromProjectName = fromProjectName;
        this.fromProjectVersionNumber = fromProjectVersionNumber;
    }

    public static OPMProject fromJson(JSONObject obj) {
        String name = obj.getString("project_name");
        String workspace = obj.getString("workspace");
        String fromName = obj.has("from_project_name") ? obj.getString("from_project_name") : null;
        Integer fromVersion = obj.has("from_project_version_number") ? obj.getInt("from_project_version_number") : null;
        return new OPMProject(name, workspace, fromName, fromVersion);
    }
}
