package com.oracle.determinations.migration;

import org.json.JSONObject;

/**
 * Represents a decision service project with optional source linkage and workspace.
 */
public class DecisionServiceProject {
    public final String projectName;
    public final String workspace;
    public final String fromProjectName;
    public final Integer fromVersionNumber;

    /**
     * Constructs a decision service project descriptor.
     * @param projectName Decision service project name.
     * @param workspace Workspace the decision service project belongs to.
     * @param fromProjectName Optional source project name for initial version cloning.
     * @param fromVersionNumber Optional source project version number for cloning.
     */
    public DecisionServiceProject(String projectName, String workspace, String fromProjectName, Integer fromVersionNumber) {
        this.projectName = projectName;
        this.workspace = workspace;
        this.fromProjectName = fromProjectName;
        this.fromVersionNumber = fromVersionNumber;
    }

    /**
     * Builds a decision service project from a JSON object.
     * @param obj JSON with keys: module_name, workspace, and optional from_module_name, from_version_number.
     * @return parsed DecisionServiceProject instance.
     * @throws org.json.JSONException if required fields are missing or invalid.
     */
    public static DecisionServiceProject fromJson(JSONObject obj) {
        String projectName = obj.getString("module_name");
        String workspace = obj.getString("workspace");
        String fromProjectName = obj.has("from_module_name") ? obj.getString("from_module_name") : null;
        Integer fromVersionNumber = obj.has("from_version_number") ? obj.getInt("from_version_number") : null;
        return new DecisionServiceProject(projectName, workspace, fromProjectName, fromVersionNumber);
    }
}
