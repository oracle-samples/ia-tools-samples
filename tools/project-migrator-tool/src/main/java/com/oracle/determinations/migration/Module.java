package com.oracle.determinations.migration;

import org.json.JSONObject;

/**
 * Represents a decision module with optional source linkage and workspace.
 */
public class Module {
    public final String moduleName;
    public final String workspace;
    public final String fromModuleName;
    public final Integer fromVersionNumber;

    /**
     * Constructs a Module descriptor.
     * @param moduleName Module name.
     * @param workspace Workspace the module belongs to.
     * @param fromModuleName Optional source module name for initial version cloning.
     * @param fromVersionNumber Optional source module version number for cloning.
     */
    public Module(String moduleName, String workspace, String fromModuleName, Integer fromVersionNumber) {
        this.moduleName = moduleName;
        this.workspace = workspace;
        this.fromModuleName = fromModuleName;
        this.fromVersionNumber = fromVersionNumber;
    }

    /**
     * Builds a Module from a JSON object.
     * @param obj JSON with keys: module_name, workspace, and optional from_module_name, from_version_number.
     * @return parsed Module instance.
     * @throws org.json.JSONException if required fields are missing or invalid.
     */
    public static Module fromJson(JSONObject obj) {
        String moduleName = obj.getString("module_name");
        String workspace = obj.getString("workspace");
        String fromModuleName = obj.has("from_module_name") ? obj.getString("from_module_name") : null;
        Integer fromVersionNumber = obj.has("from_version_number") ? obj.getInt("from_version_number") : null;
        return new Module(moduleName, workspace, fromModuleName, fromVersionNumber);
    }
}
