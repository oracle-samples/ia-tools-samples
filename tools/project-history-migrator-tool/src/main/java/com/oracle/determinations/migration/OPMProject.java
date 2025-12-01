/**
 * Copyright © 2025, Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
package com.oracle.determinations.migration;

import org.json.JSONObject;

/**
 * Represents an OPM policy model project, including optional source project linkage and workspace.
 */
public class OPMProject {
    public final String projectName;
    public final String fromProjectName;
    public final Integer fromProjectVersionNumber;
    public final String workspace;

    /**
     * Constructs an OPMProject descriptor.
     * @param projectName Project name.
     * @param workspace Workspace the project belongs to.
     * @param fromProjectName Optional source project name for initial version cloning.
     * @param fromProjectVersionNumber Optional source project version number for cloning.
     */
    public OPMProject(String projectName, String workspace, String fromProjectName, Integer fromProjectVersionNumber) {
        this.projectName = projectName;
        this.workspace = workspace;
        this.fromProjectName = fromProjectName;
        this.fromProjectVersionNumber = fromProjectVersionNumber;
    }

    /**
     * Builds an OPMProject from a JSON object.
     * @param obj JSON with keys: project_name, workspace, and optional from_project_name, from_project_version_number.
     * @return parsed OPMProject instance.
     * @throws org.json.JSONException if required fields are missing or invalid.
     */
    public static OPMProject fromJson(JSONObject obj) {
        String name = obj.getString("project_name");
        String workspace = obj.getString("workspace");
        String fromName = obj.has("from_project_name") ? obj.getString("from_project_name") : null;
        Integer fromVersion = obj.has("from_project_version_number") ? obj.getInt("from_project_version_number") : null;
        return new OPMProject(name, workspace, fromName, fromVersion);
    }
}
