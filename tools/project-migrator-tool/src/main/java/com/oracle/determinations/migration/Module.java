package com.oracle.determinations.migration;

import org.json.JSONObject;

public class Module {
    public final String moduleName;
    public final String workspace;
    public final String fromModuleName;
    public final Integer fromVersionNumber;

    public Module(String moduleName, String workspace, String fromModuleName, Integer fromVersionNumber) {
        this.moduleName = moduleName;
        this.workspace = workspace;
        this.fromModuleName = fromModuleName;
        this.fromVersionNumber = fromVersionNumber;
    }

    public static Module fromJson(JSONObject obj) {
        String moduleName = obj.getString("module_name");
        String workspace = obj.getString("workspace");
        String fromModuleName = obj.has("from_module_name") ? obj.getString("from_module_name") : null;
        Integer fromVersionNumber = obj.has("from_version_number") ? obj.getInt("from_version_number") : null;
        return new Module(moduleName, workspace, fromModuleName, fromVersionNumber);
    }
}
