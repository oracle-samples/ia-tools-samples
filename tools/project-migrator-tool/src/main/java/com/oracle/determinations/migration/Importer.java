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

public class Importer {

    private Map<String, JSONObject> projectsByName;

    public Importer() {
        projectsByName = new HashMap<>();
    }

    public void doImport(String iaHostUrl, String iaUsername, String iaPassword, String exportedPayloadPath) throws Exception {
        String oAuthToken = authenticate(iaHostUrl, iaUsername, iaPassword);
        ZipFile zip = new ZipFile(new File(exportedPayloadPath));

        // Read all entities up front
        ZipEntry projectsEntry = zip.getEntry("projects.json");
        JSONArray projects;
        try (java.io.InputStream is = zip.getInputStream(projectsEntry)) {
            String json = new String(readAllBytes(is), java.nio.charset.StandardCharsets.UTF_8);
            projects = new JSONArray(json);
        }
        ZipEntry projectVersionsEntry = zip.getEntry("project_versions.json");
        JSONArray projectVersions;
        try (java.io.InputStream is = zip.getInputStream(projectVersionsEntry)) {
            String json = new String(readAllBytes(is), java.nio.charset.StandardCharsets.UTF_8);
            projectVersions = new JSONArray(json);
        }
        ZipEntry modulesEntry = zip.getEntry("modules.json");
        ZipEntry moduleVersionsEntry = zip.getEntry("module_versions.json");
        JSONArray modules = null;
        JSONArray moduleVersions = null;
        if (modulesEntry != null && moduleVersionsEntry != null) {
            try (java.io.InputStream is = zip.getInputStream(modulesEntry)) {
                String json = new String(readAllBytes(is), java.nio.charset.StandardCharsets.UTF_8);
                modules = new JSONArray(json);
            }
            try (java.io.InputStream is = zip.getInputStream(moduleVersionsEntry)) {
                String json = new String(readAllBytes(is), java.nio.charset.StandardCharsets.UTF_8);
                moduleVersions = new JSONArray(json);
            }
        }

        // --- CLASH DETECTION ---
        checkForNameClashes(iaHostUrl, oAuthToken, projects, modules);

        // --- Proceed to import ---
        uploadVersions(iaHostUrl, oAuthToken, projects, projectVersions, zip);

        if (modules != null && moduleVersions != null) {
            uploadModules(iaHostUrl, oAuthToken, modules, moduleVersions);
        }

        zip.close();
    }

    // Check for clashes between import names and existing hub projects
    private void checkForNameClashes(String iaHostUrl, String oAuthToken, JSONArray projects, JSONArray modules) throws Exception {
        // Collect all import names
        Set<String> importNames = new HashSet<>();
        for (int i = 0; i < projects.length(); i++) {
            JSONObject project = projects.getJSONObject(i);
            String projectName = project.getString("project_name");
            if (projectName != null) importNames.add(projectName);
        }
        if (modules != null) {
            for (int i = 0; i < modules.length(); i++) {
                JSONObject module = modules.getJSONObject(i);
                String moduleName = module.getString("module_name");
                if (moduleName != null) importNames.add(moduleName);
            }
        }

        // Fetch all project names from target hub using Apache HttpClient
        String url = iaHostUrl;
        if (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        url += "/opa-hub/api/12.2.39/projects?fields=name";

        String responseText;
        int statusCode;
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpGet httpGet = new HttpGet(url);
            httpGet.setHeader(HttpHeaders.AUTHORIZATION, "Bearer " + oAuthToken);
            httpGet.setHeader(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());

            try (CloseableHttpResponse response = httpClient.execute(httpGet)) {
                statusCode = response.getStatusLine().getStatusCode();
                HttpEntity entity = response.getEntity();
                responseText = entity != null ? EntityUtils.toString(entity, "UTF-8") : "";
            }
        }

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

    private void uploadVersions(String iaHostUrl, String oAuthToken, JSONArray projects, JSONArray projectVersions, ZipFile zip) throws Exception {
        for (int i = 0; i < projects.length(); i++) {
            JSONObject project = projects.getJSONObject(i);
            String projectName = project.getString("project_name");

            projectsByName.put(projectName, project);
        }

        for (int i = 0; i < projectVersions.length(); i++) {
            JSONObject projectVersion = projectVersions.getJSONObject(i);
            String projectName = projectVersion.getString("project_name");
            int projectVersionNumber = projectVersion.getInt("project_version_number");
            String versionDescription = projectVersion.getString("description");
            String userName = projectVersion.getString("user_name");
            String opaVersion = projectVersion.getString("opa_version");
            String creationDate = projectVersion.getString("creation_date");
            String workspace = projectVersion.getString("workspace");

            String descriptionUpdatedDate = projectVersion.has("description_updated") ? projectVersion.getString("description_updated") : null;
            String descriptionAuthor = projectVersion.has("description_author") ? projectVersion.getString("description_author") : null;

            // Get snapshot fingerprint
            JSONObject snapshotObj = projectVersion.getJSONObject("snapshot");
            String fingerprint = snapshotObj.getString("fingerprint_sha256");

            // Read snapshot bytes from zip
            ZipEntry snapshotEntry = zip.getEntry(fingerprint);
            if (snapshotEntry == null) {
                throw new RuntimeException("Snapshot file not found in zip: " + fingerprint);
            }
            byte[] snapshotBytes;
            try (java.io.InputStream is = zip.getInputStream(snapshotEntry)) {
                snapshotBytes = readAllBytes(is);
            }

            // get inclusion override counts
            Map<String, Integer> inclusionOverrideCounts = new HashMap<>();
            if (projectVersion.has("project_version_inclusions")) {
                JSONArray projectVersionInclusions = projectVersion.getJSONArray("project_version_inclusions");
                for (int j = 0; j < projectVersionInclusions.length(); j++) {
                    JSONObject projectVersionInclusion = projectVersionInclusions.getJSONObject(j);
                    String includedProjectName = projectVersionInclusion.getString("included_project_name");
                    int overrideCount = projectVersionInclusion.getInt("inclusion_override_count");
                    inclusionOverrideCounts.put(includedProjectName, overrideCount);
                }
            }

            // project changes
            Map<String, String> changes = new HashMap<>();
            if (projectVersion.has("project_version_changes")) {
                JSONArray projectVersionChanges = projectVersion.getJSONArray("project_version_changes");
                for (int j = 0; j < projectVersionChanges.length(); j++) {
                    JSONObject projectVersionChange = projectVersionChanges.getJSONObject(j);
                    String objectName = projectVersionChange.getString("object_name");
                    String changeType = projectVersionChange.getString("change_type");
                    changes.put(objectName, changeType);
                }
            }

            // Call uploadProjectVersion with status messages
            uploadProjectVersion(iaHostUrl, oAuthToken, projectName, projectVersionNumber, versionDescription, userName, opaVersion, creationDate,
                    workspace, descriptionUpdatedDate, descriptionAuthor, inclusionOverrideCounts, changes, snapshotBytes);
            System.out.println("Imported project version: " + projectName + " (version " + projectVersionNumber + ")");
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
            JSONObject projectObj = projectsByName.get(projectName);
            if (projectObj.has("from_project_name")) {
                body.put("from_project_name", projectObj.getString("from_project_name"));
                body.put("from_project_version_number", projectObj.getInt("from_project_version_number"));
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

        // Send POST request using Apache HttpClient
        int statusCode;
        String responseText;
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpPost httpPost = new HttpPost(url);
            httpPost.setHeader(HttpHeaders.AUTHORIZATION, "Bearer " + oAuthToken);
            httpPost.setHeader(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());
            httpPost.setHeader(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_JSON.getMimeType());
            httpPost.setEntity(new StringEntity(body.toString(), "UTF-8"));

            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                statusCode = response.getStatusLine().getStatusCode();
                HttpEntity entity = response.getEntity();
                responseText = entity != null ? EntityUtils.toString(entity, "UTF-8") : "";
            }
        }

        if (statusCode < 200 || statusCode >= 300) {
            throw new RuntimeException("Upload failed. HTTP code: " + statusCode + "\nResponse: " + responseText);
        }
    }

    // Upload modules and all their versions (batched) as projects using /projects endpoint
    private void uploadModules(String iaHostUrl, String oAuthToken, JSONArray modules, JSONArray moduleVersions) throws Exception {
        // Group all versions for each module
        Map<String, JSONObject> moduleByName = new HashMap<>();

        String url = iaHostUrl + "/opa-hub/api/experimental/opm_projects";

        for (int i = 0; i < modules.length(); i++) {
            JSONObject module = modules.getJSONObject(i);
            String moduleName = module.getString("module_name");
            moduleByName.put(moduleName, module);
        }

        for (int i=0; i < moduleVersions.length(); i++) {
            JSONObject moduleVersion = moduleVersions.getJSONObject(i);
            String moduleName = moduleVersion.getString("module_name");
            JSONObject module = moduleByName.get(moduleName);

            JSONObject postBody = new JSONObject(moduleVersion);
            postBody.put("migrator_tool", true);
            if (module.has("from_module_name")) {
                postBody.put("from_module_name", module.getString("from_module_name"));
                postBody.put("from_version_number", module.getInt("from_version_number"));   
            }

            // POST the project using Apache HttpClient
            int statusCode;
            String responseText;
            try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
                HttpPost httpPost = new HttpPost(url);
                httpPost.setHeader(HttpHeaders.AUTHORIZATION, "Bearer " + oAuthToken);
                httpPost.setHeader(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());
                httpPost.setHeader(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_JSON.getMimeType());
                httpPost.setEntity(new StringEntity(postBody.toString(), "UTF-8"));

                try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                    statusCode = response.getStatusLine().getStatusCode();
                    HttpEntity entity = response.getEntity();
                    responseText = entity != null ? EntityUtils.toString(entity, "UTF-8") : "";
                }
            }

            if (statusCode < 200 || statusCode >= 300) {
                throw new RuntimeException("Module import failed. HTTP code: " + statusCode + "\nResponse: " + responseText);
            }
            System.out.println("Imported module: " + moduleName + " version: " + moduleVersion.getInt("version_number"));
                     
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

            int statusCode;
            String responseText;

            try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
                HttpPost httpPost = new HttpPost(authUrl);
                httpPost.setHeader(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());
                httpPost.setHeader(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_FORM_URLENCODED.getMimeType());
                httpPost.setEntity(new StringEntity(form.toString(), "UTF-8"));

                try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                    statusCode = response.getStatusLine().getStatusCode();
                    HttpEntity entity = response.getEntity();
                    responseText = entity != null ? EntityUtils.toString(entity, "UTF-8") : "";
                }
            }

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
