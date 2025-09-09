package com.oracle.determinations.migration;

import java.util.Base64;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.apache.http.HttpHeaders;
import org.apache.http.entity.ContentType;
import org.apache.http.HttpEntity;

import java.io.File;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;

public class Importer {

    private Map<String, Project> projectsByName;

    public Importer() {
        projectsByName = new HashMap<>();
    }

    public void doImport(String iaHostUrl, String iaUsername, String iaPassword, String exportedPayloadPath, String resumeJournalPath) throws Exception {
        String oAuthToken = authenticate(iaHostUrl, iaUsername, iaPassword);
        ZipFile zip = new ZipFile(new File(exportedPayloadPath));

        // Read all entities up front
        ZipEntry projectsEntry = zip.getEntry("projects.json");
        List<Project> projects;
        try (java.io.InputStream is = zip.getInputStream(projectsEntry)) {
            String json = new String(readAllBytes(is), StandardCharsets.UTF_8);
            JSONArray arr = new JSONArray(json);
            projects = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                projects.add(Project.fromJson(arr.getJSONObject(i)));
            }
        }
        ZipEntry projectVersionsEntry = zip.getEntry("project_versions.json");
        List<ProjectVersion> projectVersions;
        try (java.io.InputStream is = zip.getInputStream(projectVersionsEntry)) {
            String json = new String(readAllBytes(is), StandardCharsets.UTF_8);
            JSONArray arr = new JSONArray(json);
            projectVersions = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                projectVersions.add(ProjectVersion.fromJson(arr.getJSONObject(i)));
            }
        }
        ZipEntry modulesEntry = zip.getEntry("modules.json");
        ZipEntry moduleVersionsEntry = zip.getEntry("module_versions.json");
        List<Module> modules = null;
        List<ModuleVersion> moduleVersions = null;
        if (modulesEntry != null && moduleVersionsEntry != null) {
            try (java.io.InputStream is = zip.getInputStream(modulesEntry)) {
                String json = new String(readAllBytes(is), StandardCharsets.UTF_8);
                JSONArray arr = new JSONArray(json);
                modules = new ArrayList<>();
                for (int i = 0; i < arr.length(); i++) {
                    modules.add(Module.fromJson(arr.getJSONObject(i)));
                }
            }
            try (java.io.InputStream is = zip.getInputStream(moduleVersionsEntry)) {
                String json = new String(readAllBytes(is), StandardCharsets.UTF_8);
                JSONArray arr = new JSONArray(json);
                moduleVersions = new ArrayList<>();
                for (int i = 0; i < arr.length(); i++) {
                    moduleVersions.add(ModuleVersion.fromJson(arr.getJSONObject(i)));
                }
            }
        }
 
        // Optional resume from journal
        if (resumeJournalPath != null && !resumeJournalPath.trim().isEmpty()) {
            ResumeInfo resume = validateJournalAgainstPayload(iaHostUrl, oAuthToken, resumeJournalPath, projectVersions, moduleVersions);
            if (resume.projectSkip > 0) {
                if (resume.projectSkip > projectVersions.size()) {
                    throw new RuntimeException("Resume journal indicates more project versions than present in the payload.");
                }
                projectVersions = projectVersions.subList(resume.projectSkip, projectVersions.size());
            }
            if (moduleVersions != null && resume.moduleSkip > 0) {
                if (resume.moduleSkip > moduleVersions.size()) {
                    throw new RuntimeException("Resume journal indicates more module versions than present in the payload.");
                }
                moduleVersions = moduleVersions.subList(resume.moduleSkip, moduleVersions.size());
            } else if (resume.moduleSkip > 0 && moduleVersions == null) {
                throw new RuntimeException("Resume journal lists module versions, but the exported payload contains none.");
            }
        }
 
        // --- CLASH DETECTION ---
        checkForNameClashes(iaHostUrl, oAuthToken, projects, modules);

        // --- Proceed to import ---
        String journalFileName = "import-" + System.currentTimeMillis() + ".json";
        try (Journal journal = new Journal(journalFileName)) {
            uploadVersions(iaHostUrl, oAuthToken, projects, projectVersions, zip, journal);

            if (modules != null && moduleVersions != null) {
                uploadModules(iaHostUrl, oAuthToken, modules, moduleVersions, journal);
            }
        }

        zip.close();
    }

    // Check for clashes between import names and existing hub projects
    private void checkForNameClashes(String iaHostUrl, String oAuthToken, List<Project> projects, List<Module> modules) throws Exception {
        // Collect all import names
        Set<String> importNames = new HashSet<>();
        for (Project project : projects) {
            String projectName = project.projectName;
            if (projectName != null) importNames.add(projectName);
        }
        if (modules != null) {
            for (Module module : modules) {
                String moduleName = module.moduleName;
                if (moduleName != null) importNames.add(moduleName);
            }
        }

        // Fetch all project names from target hub using Apache HttpClient
        String url = iaHostUrl;
        if (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        url += "/opa-hub/api/12.2.39/projects?fields=name";

        Map<String, String> headers = new HashMap<>();
        headers.put(HttpHeaders.AUTHORIZATION, "Bearer " + oAuthToken);
        headers.put(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());
        HttpResult httpRes = httpRequest("GET", url, headers, null);
        int statusCode = httpRes.statusCode;
        String responseText = httpRes.body;

        if (statusCode < 200 || statusCode >= 300) {
            throw new RuntimeException("Failed to fetch projects from target hub. HTTP code: " + statusCode + "\nResponse: " + responseText);
        }

        Set<String> existingNames = new HashSet<>();
        JSONObject projectsObject = new JSONObject(responseText);
        if (projectsObject.has("items")) {
            JSONArray existingProjects = projectsObject.getJSONArray("items");
            for (int i = 0; i < existingProjects.length(); i++) {
                JSONObject item = existingProjects.getJSONObject(i);
                String name = item.has("name") ? item.getString("name") : null;
                if (name != null) existingNames.add(name);
            }
        }

        // Check for any clash
        ArrayList<String> clashes = new ArrayList<>();
        for (String name : importNames) {
            if (existingNames.contains(name)) {
                clashes.add(name);
            }
        }
        if (!clashes.isEmpty()) {
            throw new RuntimeException("Import cancelled due to name clash with project(s)/module(s) already on the target hub: " + String.join(", ", clashes));
        }
    }

    private void uploadVersions(String iaHostUrl, String oAuthToken, List<Project> projects, List<ProjectVersion> projectVersions, ZipFile zip, Journal journal) throws Exception {
        for (Project project : projects) {
            projectsByName.put(project.projectName, project);
        }

        for (ProjectVersion projectVersion : projectVersions) {
            String projectName = projectVersion.projectName;
            int projectVersionNumber = projectVersion.projectVersionNumber;
            String versionDescription = projectVersion.description;
            String userName = projectVersion.userName;
            String opaVersion = projectVersion.opaVersion;
            String creationDate = projectVersion.creationDate;
            String workspace = projectVersion.workspace;

            String descriptionUpdatedDate = projectVersion.descriptionUpdated;
            String descriptionAuthor = projectVersion.descriptionAuthor;

            // Get snapshot fingerprint
            String fingerprint = projectVersion.snapshotFingerprintSha256;

            // Read snapshot bytes from zip
            ZipEntry snapshotEntry = zip.getEntry(fingerprint);
            if (snapshotEntry == null) {
                throw new RuntimeException("Snapshot file not found in zip: " + fingerprint);
            }
            byte[] snapshotBytes;
            try (java.io.InputStream is = zip.getInputStream(snapshotEntry)) {
                snapshotBytes = readAllBytes(is);
            }

            // inclusion override counts and project changes
            Map<String, Integer> inclusionOverrideCounts = projectVersion.inclusionOverrideCounts;
            Map<String, String> changes = projectVersion.changes;

            // Call uploadProjectVersion with status messages
            uploadProjectVersion(iaHostUrl, oAuthToken, projectName, projectVersionNumber, versionDescription, userName, opaVersion, creationDate,
                    workspace, descriptionUpdatedDate, descriptionAuthor, inclusionOverrideCounts, changes, snapshotBytes);
            System.out.println("Imported project version: " + projectName + " (version " + projectVersionNumber + ")");
            journal.write(projectVersion.toJSON());
        }
    }

    /**
     * Upload a project version to the OPA Hub.
     */
    private void uploadProjectVersion(String iaHostUrl,
                                      String oAuthToken,
                                      String projectName,
                                      int projectVersionNumber,
                                      String description,
                                      String userName,
                                      String opaVersion,
                                      String creationDate,
                                      String workspace,
                                      String descriptionUpdatedDate,
                                      String descriptionAuthor,
                                      Map<String, Integer> inclusionOverrideCounts,
                                      Map<String, String> changes,
                                      byte[] snapshotBytes) throws Exception {

        // Build request JSON
        JSONObject body = new JSONObject();
        body.put("migrator_tool", true);
        body.put("project_name", projectName);
        body.put("project_version_number", projectVersionNumber);
        body.put("opa_version", opaVersion);
        body.put("description", description);
        body.put("user_name", userName);
        body.put("creation_date", creationDate);
        body.put("workspace", workspace);
        body.put("description_updated", descriptionUpdatedDate);
        body.put("description_author", descriptionAuthor);

        if (projectVersionNumber == 1) {
            Project projectObj = projectsByName.get(projectName);
            if (projectObj != null && projectObj.fromProjectName != null) {
                body.put("from_project_name", projectObj.fromProjectName);
                if (projectObj.fromProjectVersionNumber != null) {
                    body.put("from_project_version_number", projectObj.fromProjectVersionNumber);
                }
            }
        }

        if (!inclusionOverrideCounts.isEmpty()) {
            JSONObject inclusionOverrideCountsObj = new JSONObject();
            for (String includedProjectName : inclusionOverrideCounts.keySet()) {
                int inclusionOverrideCount = inclusionOverrideCounts.get(includedProjectName);
                inclusionOverrideCountsObj.put(includedProjectName, inclusionOverrideCount);
            }
            body.put("inclusion_override_counts", inclusionOverrideCountsObj);
        }

        if (!changes.isEmpty()) {
            JSONObject changesObj = new JSONObject();
            for (String objectName : changes.keySet()) {
                changesObj.put(objectName, changes.get(objectName));
            }
            body.put("changes", changesObj);
        }

        JSONObject snapshot = new JSONObject();

        // Encode snapshotBytes as base64
        String snapshotBase64 = Base64.getEncoder().encodeToString(snapshotBytes);
        snapshot.put("snapshot_base64", snapshotBase64);

        body.put("snapshot", snapshot);

        // Build URL
        String url = iaHostUrl;
        if (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        url += "/opa-hub/api/experimental/opm_projects";

        Map<String, String> headers = new HashMap<>();
        headers.put(HttpHeaders.AUTHORIZATION, "Bearer " + oAuthToken);
        headers.put(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());
        headers.put(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_JSON.getMimeType());
        HttpResult httpRes = httpRequest("POST", url, headers, body.toString());
        int statusCode = httpRes.statusCode;
        String responseText = httpRes.body;

        if (statusCode < 200 || statusCode >= 300) {
            throw new RuntimeException("Upload failed. HTTP code: " + statusCode + "\nResponse: " + responseText);
        }
    }

    // Upload modules and all their versions (batched) as projects using /projects endpoint
    private void uploadModules(String iaHostUrl, String oAuthToken, List<Module> modules, List<ModuleVersion> moduleVersions, Journal journal) throws Exception {
        // Group all versions for each module
        Map<String, Module> moduleByName = new HashMap<>();

        String url = iaHostUrl + "/opa-hub/api/experimental/opm_projects";

        for (Module module : modules) {
            String moduleName = module.moduleName;
            moduleByName.put(moduleName, module);
        }

        for (ModuleVersion moduleVersion : moduleVersions) {
            String moduleName = moduleVersion.moduleName;
            Module module = moduleByName.get(moduleName);

            int versionNumber = moduleVersion.versionNumber;

            JSONObject postBody = new JSONObject();
            postBody.put("migrator_tool", true);
            if (module != null && module.fromModuleName != null) {
                postBody.put("from_module_name", module.fromModuleName);
                if (module.fromVersionNumber != null) {
                    postBody.put("from_version_number", module.fromVersionNumber);
                }
            }

            postBody.put("module_name", moduleName);
            if (module != null && module.workspace != null) {
                postBody.put("workspace", module.workspace);
            }
            postBody.put("create_timestamp", moduleVersion.createTimestamp);
            postBody.put("module_imported", moduleVersion.moduleImported);
            postBody.put("user_name", moduleVersion.userName);
            postBody.put("version_number", moduleVersion.versionNumber);
            postBody.put("definition", moduleVersion.definition);
            if (moduleVersion.description != null) {
                postBody.put("description", moduleVersion.description);
            }
            if (moduleVersion.descriptionUpdated != null) {
                postBody.put("description_updated", moduleVersion.descriptionUpdated);
            }
            if (moduleVersion.descriptionAuthor != null) {
                postBody.put("description_author", moduleVersion.descriptionAuthor);
            }
            postBody.put("fingerprint_sha256", moduleVersion.fingerprintSha256);

            Map<String, String> headers = new HashMap<>();
            headers.put(HttpHeaders.AUTHORIZATION, "Bearer " + oAuthToken);
            headers.put(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());
            headers.put(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_JSON.getMimeType());
            HttpResult httpRes = httpRequest("POST", url, headers, postBody.toString());
            int statusCode = httpRes.statusCode;
            String responseText = httpRes.body;

            if (statusCode < 200 || statusCode >= 300) {
                throw new RuntimeException("Module import failed. HTTP code: " + statusCode + "\nResponse: " + responseText);
            }
            System.out.println("Imported module: " + moduleName + " version: " + (versionNumber == 0 ? "draft" : versionNumber));
            journal.write(moduleVersion.toJSON());
                     
        }
    }

    private String authenticate(String iaHostUrl, String iaUsername, String iaPassword) {
        try {
            // Format the authentication URL
            String authUrl = iaHostUrl;
            if (authUrl.endsWith("/")) {
                authUrl = authUrl.substring(0, authUrl.length() - 1);
            }
            authUrl += "/opa-hub/api/experimental/auth";

            StringBuilder form = new StringBuilder();
            form.append("grant_type=client_credentials");
            form.append("&client_id=").append(java.net.URLEncoder.encode(iaUsername, "UTF-8"));
            form.append("&client_secret=").append(java.net.URLEncoder.encode(iaPassword, "UTF-8"));

            Map<String, String> headers = new HashMap<>();
            headers.put(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());
            headers.put(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_FORM_URLENCODED.getMimeType());
            HttpResult httpRes = httpRequest("POST", authUrl, headers, form.toString());
            int statusCode = httpRes.statusCode;
            String responseText = httpRes.body;

            if (statusCode >= 200 && statusCode < 300) {
                JSONObject tokenJson = new JSONObject(responseText);
                String accessToken = tokenJson.optString("access_token", null);
                if (accessToken != null && !accessToken.isEmpty()) {
                    return accessToken;
                } else {
                    throw new RuntimeException("Authentication succeeded but access_token not found in response.");
                }
            } else {
                throw new RuntimeException("Authentication failed. HTTP code: " + statusCode + "\nResponse: " + responseText);
            }
        } catch (Exception ex) {
            throw new RuntimeException("Exception during OAuth authentication", ex);
        }
    }

    // Resume support
    private static class ResumeInfo {
        final int projectSkip;
        final int moduleSkip;
        ResumeInfo(int projectSkip, int moduleSkip) {
            this.projectSkip = projectSkip;
            this.moduleSkip = moduleSkip;
        }
    }

    private ResumeInfo validateJournalAgainstPayload(String iaHostUrl, String oAuthToken, String journalPath, List<ProjectVersion> projectVersions, List<ModuleVersion> moduleVersions) throws Exception {
        // Parse journal into domain objects (must be projects first, then modules)
        java.util.List<ProjectVersion> journalProjects = new java.util.ArrayList<>();
        java.util.List<ModuleVersion> journalModules = new java.util.ArrayList<>();
        boolean inModuleSection = false;
        int lineNo = 0;

        try (java.io.BufferedReader br = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(journalPath), StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                lineNo++;
                String trimmed = line.trim();
                if (trimmed.isEmpty()) {
                    continue;
                }
                JSONObject obj;
                try {
                    obj = new JSONObject(trimmed);
                } catch (Exception ex) {
                    throw new RuntimeException("Invalid JSON in journal at line " + lineNo + ": " + ex.getMessage(), ex);
                }

                boolean isProject = obj.has("project_name") && obj.has("project_version_number");
                boolean isModule = obj.has("module_name") && obj.has("version_number");
                if (!isProject && !isModule) {
                    throw new RuntimeException("Unrecognized entry in journal at line " + lineNo + ". Expected a project or module version object.");
                }

                if (isProject) {
                    if (inModuleSection) {
                        throw new RuntimeException("Journal entry for a project version found after module entries at line " + lineNo + ". Journal must list all project versions first, then module versions.");
                    }
                    ProjectVersion pv = ProjectVersion.fromJson(obj);
                    journalProjects.add(pv);
                } else {
                    inModuleSection = true;
                    ModuleVersion mv = ModuleVersion.fromJson(obj);
                    journalModules.add(mv);
                }
            }
        }

        // Validate against exported payload (journal must be a prefix of payload lists and in same order)
        if (journalProjects.size() > projectVersions.size()) {
            throw new RuntimeException("Journal lists " + journalProjects.size() + " project version(s), but payload contains only " + projectVersions.size() + ".");
        }
        for (int i = 0; i < journalProjects.size(); i++) {
            ProjectVersion expected = projectVersions.get(i);
            ProjectVersion actual = journalProjects.get(i);
            if (!expected.equals(actual)) {
                throw new RuntimeException(
                        "Journal project mismatch vs payload at position " + (i + 1) +
                        ". Expected " + expected.projectName + "@" + expected.projectVersionNumber +
                        " but found " + actual.projectName + "@" + actual.projectVersionNumber + "."
                );
            }
        }
        if (journalModules.size() > (moduleVersions == null ? 0 : moduleVersions.size())) {
            int mvSize = moduleVersions == null ? 0 : moduleVersions.size();
            throw new RuntimeException("Journal lists " + journalModules.size() + " module version(s), but payload contains only " + mvSize + ".");
        }
        if (moduleVersions != null) {
            for (int i = 0; i < journalModules.size(); i++) {
                ModuleVersion expected = moduleVersions.get(i);
                ModuleVersion actual = journalModules.get(i);
                if (!expected.equals(actual)) {
                    throw new RuntimeException(
                            "Journal module mismatch vs payload at position " + (i + 1) +
                            ". Expected " + expected.moduleName + "@" + expected.versionNumber +
                            " but found " + actual.moduleName + "@" + actual.versionNumber + "."
                    );
                }
            }
        }

        // Fetch current Hub projects (both kinds) with their versions, grouped by name
        HubVersions hub = fetchHubVersions(iaHostUrl, oAuthToken);

        // Build journal maps grouped by name to compare exact version lists per name
        Map<String, java.util.List<ProjectVersion>> journalProjectsByName = new HashMap<>();
        for (ProjectVersion pv : journalProjects) {
            journalProjectsByName.computeIfAbsent(pv.projectName, k -> new java.util.ArrayList<>()).add(pv);
        }
        Map<String, java.util.List<ModuleVersion>> journalModulesByName = new HashMap<>();
        for (ModuleVersion mv : journalModules) {
            journalModulesByName.computeIfAbsent(mv.moduleName, k -> new java.util.ArrayList<>()).add(mv);
        }

        // Validate that for each project in the journal, the Hub has exactly the same versions and ordering (no extras)
        for (Map.Entry<String, java.util.List<ProjectVersion>> e : journalProjectsByName.entrySet()) {
            String name = e.getKey();
            java.util.List<ProjectVersion> journalList = e.getValue();
            java.util.List<ProjectVersion> hubList = hub.projectsByName.get(name);
            if (hubList == null) {
                throw new RuntimeException("Journal refers to project '" + name + "', but it was not found on the Hub.");
            }
            if (hubList.size() != journalList.size()) {
                throw new RuntimeException("Version count mismatch for project '" + name + "'. Hub has " + hubList.size() + " version(s) but journal lists " + journalList.size() + ".");
            }
            for (int i = 0; i < journalList.size(); i++) {
                ProjectVersion jv = journalList.get(i);
                ProjectVersion hv = hubList.get(i);
                if (!jv.equals(hv)) {
                    throw new RuntimeException("Mismatch for project '" + name + "' at position " + (i + 1) + ". Hub has " + hv.projectName + "@" + hv.projectVersionNumber + " but journal lists " + jv.projectName + "@" + jv.projectVersionNumber + ".");
                }
            }
        }

        // Validate that for each module in the journal, the Hub has exactly the same versions and ordering (no extras)
        for (Map.Entry<String, java.util.List<ModuleVersion>> e : journalModulesByName.entrySet()) {
            String name = e.getKey();
            java.util.List<ModuleVersion> journalList = e.getValue();
            java.util.List<ModuleVersion> hubList = hub.modulesByName.get(name);
            if (hubList == null) {
                throw new RuntimeException("Journal refers to module '" + name + "', but it was not found on the Hub.");
            }
            if (hubList.size() != journalList.size()) {
                throw new RuntimeException("Version count mismatch for module '" + name + "'. Hub has " + hubList.size() + " version(s) but journal lists " + journalList.size() + ".");
            }
            for (int i = 0; i < journalList.size(); i++) {
                ModuleVersion jv = journalList.get(i);
                ModuleVersion hv = hubList.get(i);
                if (!jv.equals(hv)) {
                    throw new RuntimeException("Mismatch for module '" + name + "' at position " + (i + 1) + ". Hub has " + hv.moduleName + "@" + hv.versionNumber + " but journal lists " + jv.moduleName + "@" + jv.versionNumber + ".");
                }
            }
        }

        // Return counts from the journal to skip when resuming
        return new ResumeInfo(journalProjects.size(), journalModules.size());
    }

    // Container for Hub lists grouped by name
    private static class HubVersions {
        final Map<String, java.util.List<ProjectVersion>> projectsByName;
        final Map<String, java.util.List<ModuleVersion>> modulesByName;
        HubVersions(Map<String, java.util.List<ProjectVersion>> projectsByName, Map<String, java.util.List<ModuleVersion>> modulesByName) {
            this.projectsByName = projectsByName;
            this.modulesByName = modulesByName;
        }
    }

    // Fetch projects (policy-model or policy-modeling) and modules (decision) from Hub, with versions in order
    private HubVersions fetchHubVersions(String iaHostUrl, String oAuthToken) throws Exception {
        String base = iaHostUrl;
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        String url = base + "/opa-hub/api/12.2.39/projects?expand=versions&links=none&fields=name,kind,workspace,versions";

        Map<String, String> headers = new HashMap<>();
        headers.put(HttpHeaders.AUTHORIZATION, "Bearer " + oAuthToken);
        headers.put(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());

        HttpResult res = httpRequest("GET", url, headers, null);
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new RuntimeException("Failed to fetch Hub projects for resume validation. HTTP code: " + res.statusCode + "\nResponse: " + res.body);
        }

        Map<String, java.util.List<ProjectVersion>> hubProjectsByName = new HashMap<>();
        Map<String, java.util.List<ModuleVersion>> hubModulesByName = new HashMap<>();

        JSONObject root = new JSONObject(res.body);
        if (root.has("items")) {
            JSONArray items = root.getJSONArray("items");
            for (int i = 0; i < items.length(); i++) {
                JSONObject proj = items.getJSONObject(i);
                String name = proj.optString("name", null);
                String kind = proj.optString("kind", "");
                String workspace = proj.optString("workspace", null);

                // Normalize kind to our importer terminology
                boolean isPolicyModel = "policy-model".equalsIgnoreCase(kind) || "policy-modeling".equalsIgnoreCase(kind);
                boolean isDecision = "decision".equalsIgnoreCase(kind);

                JSONObject versionsObj = proj.optJSONObject("versions");
                if (versionsObj == null || !versionsObj.has("items")) continue;
                JSONArray versionsArr = versionsObj.getJSONArray("items");

                for (int v = 0; v < versionsArr.length(); v++) {
                    JSONObject ver = versionsArr.getJSONObject(v);
                    int versionNo = ver.getInt("version");
                    String description = ver.has("description") ? ver.optString("description", null) : null;
                    String descriptionUpdatedAt = ver.has("descriptionUpdatedAt") ? ver.optString("descriptionUpdatedAt", null) : null;
                    String descriptionAuthor = ver.has("descriptionAuthor") ? ver.optString("descriptionAuthor", null) : null;
                    String author = ver.has("author") ? ver.optString("author", null) : null;
                    String createTimestamp = ver.has("createTimestamp") ? ver.optString("createTimestamp", null) : null;

                    if (isPolicyModel) {
                        // Map to ProjectVersion (fields not present on Hub remain null)
                        ProjectVersion pv = new ProjectVersion(
                                name,
                                versionNo,
                                description,
                                author,
                                null,                 // opaVersion not provided by Projects API
                                createTimestamp,
                                workspace,
                                descriptionUpdatedAt,
                                descriptionAuthor,
                                null,                 // fingerprint not provided by Projects API
                                null,
                                null
                        );
                        hubProjectsByName.computeIfAbsent(name, k -> new java.util.ArrayList<>()).add(pv);
                    } else if (isDecision) {
                        // Map to ModuleVersion
                        String definition = ver.has("definition") ? ver.get("definition").toString() : null;
                        ModuleVersion mv = new ModuleVersion(
                                name,
                                versionNo,
                                createTimestamp,
                                0,                    // moduleImported not on Projects API; set default
                                author,
                                definition,
                                description,
                                descriptionUpdatedAt,
                                descriptionAuthor,
                                null                  // fingerprint not provided by Projects API
                        );
                        hubModulesByName.computeIfAbsent(name, k -> new java.util.ArrayList<>()).add(mv);
                    }
                }
            }
        }

        return new HubVersions(hubProjectsByName, hubModulesByName);
    }


    // Generic HTTP utility for GET/POST requests
    private static class HttpResult {
        final int statusCode;
        final String body;
        HttpResult(int statusCode, String body) {
            this.statusCode = statusCode;
            this.body = body != null ? body : "";
        }
    }

    private static HttpResult httpRequest(String method, String url, Map<String, String> headers, String body) throws Exception {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            if ("GET".equalsIgnoreCase(method)) {
                HttpGet request = new HttpGet(url);
                if (headers != null) {
                    for (Map.Entry<String, String> h : headers.entrySet()) {
                        request.setHeader(h.getKey(), h.getValue());
                    }
                }
                try (CloseableHttpResponse response = httpClient.execute(request)) {
                    int sc = response.getStatusLine().getStatusCode();
                    HttpEntity entity = response.getEntity();
                    String responseText = entity != null ? EntityUtils.toString(entity, "UTF-8") : "";
                    return new HttpResult(sc, responseText);
                }
            } else if ("POST".equalsIgnoreCase(method)) {
                HttpPost request = new HttpPost(url);
                if (headers != null) {
                    for (Map.Entry<String, String> h : headers.entrySet()) {
                        request.setHeader(h.getKey(), h.getValue());
                    }
                }
                if (body != null) {
                    request.setEntity(new StringEntity(body, "UTF-8"));
                }
                try (CloseableHttpResponse response = httpClient.execute(request)) {
                    int sc = response.getStatusLine().getStatusCode();
                    HttpEntity entity = response.getEntity();
                    String responseText = entity != null ? EntityUtils.toString(entity, "UTF-8") : "";
                    return new HttpResult(sc, responseText);
                }
            } else {
                throw new IllegalArgumentException("Unsupported HTTP method: " + method);
            }
        }
    }

    // Helper method to read all bytes from an InputStream (replacement for StreamUtils.readAll)
    private static byte[] readAllBytes(java.io.InputStream input) throws java.io.IOException {
        java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
        int nRead;
        byte[] data = new byte[4096];
        while ((nRead = input.read(data, 0, data.length)) != -1) {
            buffer.write(data, 0, nRead);
        }
        buffer.flush();
        return buffer.toByteArray();
    }
}
