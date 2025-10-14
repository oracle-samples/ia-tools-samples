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
import org.apache.commons.codec.digest.DigestUtils;
import org.apache.http.HttpEntity;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URLEncoder;
import java.util.*;

import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;

/**
 * Imports exported OPA projects and decision service projects into an IA Hub with resume support.
 */
public class Importer {

    private static final String opmProjectUrlPath =  "/opa-hub/api/experimental/migrate-opm-project-version";
    private static final String decisionServiceProjectUrlPath =  "/opa-hub/api/experimental/migrate-decision-service-project-version";
    private static final String projectVersionsUrlPath = "/opa-hub/api/12.2.39/projects?expand=versions";
    private static final String workspacesUrlPath = "/opa-hub/api/12.2.39/workspaces?links=none&fields=name";
    private static final String authUrlPath = "/opa-hub/api/12.2.39/auth";

    private final Map<String, OPMProject> opmProjectsByName;
    private final Map<String, DecisionServiceProject> decisionServiceProjectsByName;

    private String resumePayloadSha256;
    private String resumeHubUrl;

    // Testability seams
    /**
     * Abstraction over HTTP for easier testing.
     */
    public interface HttpTransport {
        /**
         * Executes an HTTP request.
         * @param method HTTP method (GET or POST).
         * @param url Target URL.
         * @param headers Request headers to send.
         * @param body Optional request body for POST (UTF-8).
         * @return HTTP result with status code and body text.
         * @throws Exception if the transport fails or the request cannot be executed.
         */
        HttpResult request(String method, String url, Map<String, String> headers, String body) throws Exception;
    }

    @FunctionalInterface
    /**
     * Factory for creating Journal instances.
     */
    public interface JournalFactory {
        /**
         * Creates a Journal instance.
         * @param path File path to write journal entries to.
         * @return a Journal for the specified path.
         * @throws IOException if the file cannot be created or opened.
         */
        Journal create(String path) throws IOException;
    }

    private final HttpTransport httpTransport;
    private final JournalFactory journalFactory;

    /**
     * Creates an Importer with default HTTP transport and journal factory.
     */
    public Importer() {
        this(new DefaultHttpTransport(), Journal::new);
    }

    /**
     * Creates an Importer with injected HTTP transport and journal factory.
     */
    public Importer(HttpTransport httpTransport, JournalFactory journalFactory) {
        this.httpTransport = httpTransport;
        this.journalFactory = journalFactory;
        this.opmProjectsByName = new HashMap<>();
        this.decisionServiceProjectsByName = new HashMap<>();
    }

    /**
     * Imports the provided payload into the target IA Hub, optionally resuming from a journal.
     * @param iaHostUrl Base URL of the IA Hub.
     * @param iaUsername Client ID/username for OAuth.
     * @param iaPassword Client secret/password for OAuth.
     * @param exportedPayloadPath Path to the exported zip payload.
     * @param resumeJournalPath Optional path to a journal file to resume from.
     * @throws Exception on I/O, authentication, HTTP, or validation errors.
     */
    public void doImport(String iaHostUrl, String iaUsername, String iaPassword, String exportedPayloadPath, String resumeJournalPath) throws Exception {

        String payloadSha256 = DigestUtils.sha256Hex(Files.newInputStream(Paths.get(exportedPayloadPath)));

        ZipFile zipPayload = new ZipFile(new File(exportedPayloadPath));
        List<ProjectVersion> payloadProjectVersions = parsePayload(zipPayload);

        String oAuthToken = authenticate(iaHostUrl, iaUsername, iaPassword);

        Map<String, List<ProjectVersion>> existingProjectVersionsByName = fetchHubVersions(iaHostUrl, oAuthToken);
 
        // Optional resume from journal
        List<JSONObject> resumeEntries = null;
        int journalItemsLastIndex = -1;
        if (resumeJournalPath != null && !resumeJournalPath.isEmpty()) {
            resumeEntries = parseJournalEntries(resumeJournalPath);

            if (!resumePayloadSha256.equals(payloadSha256)) {
                throw new RuntimeException("Journal file does not match payload");
            }

            if (!resumeHubUrl.equals(iaHostUrl)) {
                throw new RuntimeException("Journal file does not match specified IA Hub");
            }

            journalItemsLastIndex = resumeEntries.get(resumeEntries.size() - 1).getInt("index");
            List<ProjectVersion> alreadyUploadedItems = payloadProjectVersions.subList(0, journalItemsLastIndex + 1);
            Map<String, List<ProjectVersion>> alreadyUploadedVersionsByProjectName = new HashMap<>();
            for (ProjectVersion projectVersion : alreadyUploadedItems) {
                alreadyUploadedVersionsByProjectName.computeIfAbsent(projectVersion.getProjectName(), k -> new ArrayList<>()).add(projectVersion);
            }

            boolean error = false;
            for (String projectName : alreadyUploadedVersionsByProjectName.keySet()) {
                if (!existingProjectVersionsByName.containsKey(projectName)) {
                    error = true;
                    System.out.println("Error - project " + projectName + " not found not on Hub");
                } else {
                    List<ProjectVersion> expectedVersions = alreadyUploadedVersionsByProjectName.get(projectName);
                    List<ProjectVersion> actualVersions = existingProjectVersionsByName.get(projectName);

                    if (!expectedVersions.equals(actualVersions)) {
                        error = true;
                        System.out.println("Error - IA Hub has version for project " + projectName + "  that do not match the payload being imported");
                    }
                }
            }
            if (error) {
                throw new RuntimeException("Could not resume import - IA Hub has projects/versions that do not match the payload being imported");
            }
        } else {
            // Fail if there are any project name clashes
            Set<String> existingProjectNames = existingProjectVersionsByName.keySet();
            Set<String> clashingProjectNames = new HashSet<>(opmProjectsByName.keySet());
            clashingProjectNames.addAll(decisionServiceProjectsByName.keySet());
            clashingProjectNames.retainAll(existingProjectNames);

            if (!clashingProjectNames.isEmpty()) {
                throw new RuntimeException("Projects with the following names already exist on the IA Hub: " + String.join(",", clashingProjectNames));
            }

            // Fail if there are any missing workspaces
            Set<String> payloadWorkspacesNames = new HashSet<>();
            for (DecisionServiceProject m : decisionServiceProjectsByName.values()) {
                payloadWorkspacesNames.add(m.workspace);
            }
            for (OPMProject project : opmProjectsByName.values()) {
                payloadWorkspacesNames.add(project.workspace);
            }

            Set<String> hubWorkspacesNames = fetchWorkspaceNames(iaHostUrl, oAuthToken);
            Set<String> missingWorkspaces = new HashSet<>(payloadWorkspacesNames);
            missingWorkspaces.removeAll(hubWorkspacesNames);
            if (!missingWorkspaces.isEmpty()) {
                throw  new RuntimeException("Target hub is missing workspaces: " + String.join(",", missingWorkspaces));
            }
        }

        // --- Proceed to import ---
        String journalFileName = newJournalFileName();

        try (Journal journal = journalFactory.create(journalFileName)) {
            JSONObject journalHeader = new JSONObject();
            journalHeader.put("payload_sha256", payloadSha256);
            journalHeader.put("hub_url", iaHostUrl);
            journal.write(journalHeader);

            List<ProjectVersion> projectVersionsToImport = new ArrayList<>(payloadProjectVersions);

            int journalIndex = 0;
            // Add any entries from the journal file we are using to resume so that we can resume again if the upload process is interrupted again
            if (resumeEntries != null) {
                for (JSONObject resumeEntry : resumeEntries) {
                    journal.write(resumeEntry);
                    journalIndex++;
                }

                projectVersionsToImport = projectVersionsToImport.subList(journalIndex, projectVersionsToImport.size());

                System.out.println("Resuming from journal");
            }


            for (ProjectVersion projectVersion: projectVersionsToImport) {
                if (projectVersion instanceof OPMProjectVersion) {
                    OPMProjectVersion opmProjectVersion = (OPMProjectVersion) projectVersion;
                    importOPMProjectVersion(opmProjectVersion, zipPayload, iaHostUrl, oAuthToken);
                    System.out.println("Imported project version: " + opmProjectVersion.projectName + " (version " + opmProjectVersion.projectVersionNumber + ")");
                    journal.write(opmProjectVersion.toJSONForJournal(journalIndex));
                } else {
                    DecisionServiceProjectVersion decisionServiceVersion = (DecisionServiceProjectVersion) projectVersion;
                    importModuleVersion(decisionServiceVersion, iaHostUrl, oAuthToken, journal);
                    System.out.println("Imported decision service project: " + decisionServiceVersion.projectName + " version: " + (decisionServiceVersion.isDraft ? "draft" : decisionServiceVersion.versionNumber));
                    journal.write(decisionServiceVersion.toJSONForJournal(journalIndex));
                }

                journalIndex++;
            }
        }

        zipPayload.close();
    }

    /**
     * Generates a timestamped journal file name.
     */
    protected String newJournalFileName() {
        return "import-" + System.currentTimeMillis() + ".json";
    }

    /**
     * Parses the payload zip into project/module version objects.
     * @param zip The payload zip file.
     * @return list of versions to import, in encountered order.
     * @throws IOException if zip entries cannot be read.
     */
    private List<ProjectVersion> parsePayload(ZipFile zip) throws IOException {
        List<ProjectVersion> projectVersions = new ArrayList<>();

        // Read all entities up front
        ZipEntry projectsEntry = zip.getEntry("projects.json");
        try (InputStream is = zip.getInputStream(projectsEntry)) {
            String json = new String(readAllBytes(is), StandardCharsets.UTF_8);
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                OPMProject opmProject = OPMProject.fromJson(arr.getJSONObject(i));
                opmProjectsByName.put(opmProject.projectName, opmProject);
            }
        }
        ZipEntry projectVersionsEntry = zip.getEntry("project_versions.json");

        try (InputStream is = zip.getInputStream(projectVersionsEntry)) {
            String json = new String(readAllBytes(is), StandardCharsets.UTF_8);
            JSONArray arr = new JSONArray(json);
            projectVersions = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                projectVersions.add(OPMProjectVersion.fromJson(arr.getJSONObject(i)));
            }
        }
        ZipEntry modulesEntry = zip.getEntry("modules.json");
        ZipEntry moduleVersionsEntry = zip.getEntry("module_versions.json");

        if (modulesEntry != null && moduleVersionsEntry != null) {
            try (InputStream is = zip.getInputStream(modulesEntry)) {
                String json = new String(readAllBytes(is), StandardCharsets.UTF_8);
                JSONArray arr = new JSONArray(json);

                for (int i = 0; i < arr.length(); i++) {
                    DecisionServiceProject module = DecisionServiceProject.fromJson(arr.getJSONObject(i));
                    decisionServiceProjectsByName.put(module.projectName, module);
                }
            }
            try (InputStream is = zip.getInputStream(moduleVersionsEntry)) {
                String json = new String(readAllBytes(is), StandardCharsets.UTF_8);
                JSONArray arr = new JSONArray(json);
                for (int i = 0; i < arr.length(); i++) {
                    projectVersions.add(DecisionServiceProjectVersion.fromJson(arr.getJSONObject(i)));
                }
            }
        }

        return projectVersions;
    }


    /**
     * Uploads an OPM project version with its snapshot to the IA Hub.
     * @param projectVersion Project version metadata and refs.
     * @param zip Payload zip containing the snapshot.
     * @param iaHostUrl Base URL of the IA Hub.
     * @param oAuthToken OAuth bearer token.
     * @throws Exception on HTTP or serialization errors.
     */
    private void importOPMProjectVersion(OPMProjectVersion projectVersion, ZipFile zip, String iaHostUrl, String oAuthToken) throws Exception {
        String projectName = projectVersion.projectName;
        int projectVersionNumber = projectVersion.projectVersionNumber;
        String versionDescription = projectVersion.description;
        String userName = projectVersion.userName;
        String opaVersion = projectVersion.opaVersion;
        String creationDate = projectVersion.creationDate;

        String descriptionUpdatedDate = projectVersion.descriptionUpdated;
        String descriptionAuthor = projectVersion.descriptionAuthor;

        OPMProject project = opmProjectsByName.get(projectName);
        String fromProjectName = project.fromProjectName;
        Integer fromProjectVersionNumber = project.fromProjectVersionNumber;
        String workspace = project.workspace;

        // Get snapshot fingerprint
        String fingerprint = projectVersion.fingerprintSha256;

        // Read snapshot bytes from zip
        ZipEntry snapshotEntry = zip.getEntry(fingerprint);
        if (snapshotEntry == null) {
            throw new RuntimeException("Snapshot file not found in zip: " + fingerprint);
        }

        byte[] snapshotBytes;
        try (InputStream is = zip.getInputStream(snapshotEntry)) {
            snapshotBytes = readAllBytes(is);
        }

        // inclusion override counts and project changes
        Map<String, Integer> inclusionOverrideCounts = projectVersion.inclusionOverrideCounts;
        Map<String, String> changes = projectVersion.changes;

        // Call uploadProjectVersion with status messages
        uploadProjectVersion(iaHostUrl, oAuthToken, projectName, projectVersionNumber, versionDescription, userName, opaVersion, creationDate,
                workspace, descriptionUpdatedDate, descriptionAuthor, inclusionOverrideCounts, changes, fromProjectName, fromProjectVersionNumber, snapshotBytes);
    }

    /**
     * Uploads a policy-model project version to the IA Hub.
     * @param iaHostUrl Base URL of the IA Hub.
     * @param oAuthToken OAuth bearer token.
     * @param projectName Project name.
     * @param projectVersionNumber Version number.
     * @param description Version description.
     * @param userName Author of the version.
     * @param opaVersion OPA version string.
     * @param creationDate Creation timestamp.
     * @param workspace Target workspace name.
     * @param descriptionUpdatedDate When the description was last updated.
     * @param descriptionAuthor Who last updated the description.
     * @param inclusionOverrideCounts Inclusion overrides by included project.
     * @param changes Object-level change map.
     * @param fromProjectName Source project name for v1 cloning (optional).
     * @param fromProjectVersionNumber Source project version for v1 cloning (optional).
     * @param snapshotBytes Snapshot payload bytes.
     * @throws Exception if the HTTP request fails or Hub returns a non-2xx status.
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
                                      String fromProjectName,
                                      Integer fromProjectVersionNumber,
                                      byte[] snapshotBytes) throws Exception {

        // Build request JSON
        JSONObject body = new JSONObject();
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
            if (fromProjectName != null) {
                body.put("from_project_name", fromProjectName);
                if (fromProjectVersionNumber != null) {
                    body.put("from_project_version_number", fromProjectVersionNumber);
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
        String url = iaHostUrl + opmProjectUrlPath;

        Map<String, String> headers = new HashMap<>();
        headers.put(HttpHeaders.AUTHORIZATION, "Bearer " + oAuthToken);
        headers.put(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());
        headers.put(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_JSON.getMimeType());
        HttpResult httpRes = httpTransport.request("POST", url, headers, body.toString());
        int statusCode = httpRes.statusCode;
        String responseText = httpRes.body;

        if (statusCode < 200 || statusCode >= 300) {
            throw new RuntimeException("Upload failed. HTTP code: " + statusCode + "\nResponse: " + responseText);
        }
    }


    /**
     * Uploads a decision service project version to the IA Hub and records it in the journal.
     * @param moduleVersion Decision service project version metadata and content.
     * @param iaHostUrl Base URL of the IA Hub.
     * @param oAuthToken OAuth bearer token.
     * @param journal Journal to write success entries to.
     * @throws Exception if the HTTP request fails or Hub returns a non-2xx status.
     */
    private void importModuleVersion(DecisionServiceProjectVersion moduleVersion, String iaHostUrl, String oAuthToken, Journal journal) throws Exception{
        String projectName = moduleVersion.projectName;
        DecisionServiceProject module = decisionServiceProjectsByName.get(projectName);

        JSONObject postBody = new JSONObject();
 
        if (module != null && module.fromProjectName != null) {
            postBody.put("from_module_name", module.fromProjectName);
            if (module.fromVersionNumber != null) {
                postBody.put("from_version_number", module.fromVersionNumber);
            }
        }

        postBody.put("module_name", projectName);
        if (module != null && module.workspace != null) {
            postBody.put("workspace", module.workspace);
        }
        postBody.put("create_timestamp", moduleVersion.createTimestamp);
        postBody.put("module_imported", moduleVersion.imported);
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

        String url = iaHostUrl + decisionServiceProjectUrlPath;

        Map<String, String> headers = new HashMap<>();
        headers.put(HttpHeaders.AUTHORIZATION, "Bearer " + oAuthToken);
        headers.put(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());
        headers.put(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_JSON.getMimeType());
        HttpResult httpRes = httpTransport.request("POST", url, headers, postBody.toString());
        int statusCode = httpRes.statusCode;
        String responseText = httpRes.body;

        if (statusCode < 200 || statusCode >= 300) {
            throw new RuntimeException("Decision service project import failed. HTTP code: " + statusCode + "\nResponse: " + responseText);
        }
    }

    /**
     * Obtains an OAuth access token from the IA Hub.
     * @param iaHostUrl Base URL of the IA Hub.
     * @param iaUsername Client ID/username.
     * @param iaPassword Client secret/password.
     * @return bearer access token.
     * @throws RuntimeException if authentication fails or response is invalid.
     */
    private String authenticate(String iaHostUrl, String iaUsername, String iaPassword) {
        String authUrl = iaHostUrl + authUrlPath;

        StringBuilder form = new StringBuilder();
        form.append("grant_type=client_credentials");
        form.append("&client_id=").append(urlEncodeUtf8(iaUsername));
        form.append("&client_secret=").append(urlEncodeUtf8(iaPassword));

        Map<String, String> headers = new HashMap<>();
        headers.put(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());
        headers.put(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_FORM_URLENCODED.getMimeType());

        HttpResult httpRes;
        try {
            httpRes = httpTransport.request("POST", authUrl, headers, form.toString());
        } catch (Exception ex) {
            throw new RuntimeException("Exception during OAuth authentication", ex);
        }

        int statusCode = httpRes.statusCode;
        String responseText = httpRes.body;

        if (statusCode >= 200 && statusCode < 300) {
            JSONObject tokenJson = new JSONObject(responseText);
            String accessToken = tokenJson.optString("access_token", null);
            if (accessToken != null && !accessToken.isEmpty()) {
                return accessToken;
            } else {
                throw new RuntimeException("Authentication succeeded but access_token not found");
            }
        } else {
            throw new RuntimeException("Authentication failed. HTTP code: " + statusCode + "\nResponse: " + responseText);
        }
    }

    /**
     * Reads an import journal and returns its entries (excluding the header).
     * @param journalPath Path to the journal file.
     * @return list of JSON entries after the header.
     * @throws RuntimeException if the file is invalid or unreadable.
     */
    private List<JSONObject> parseJournalEntries(String journalPath) {
        List<JSONObject> journalEntries = new ArrayList<>();

        try (BufferedReader br = new BufferedReader(new InputStreamReader(new FileInputStream(journalPath), StandardCharsets.UTF_8))) {
            String line;
            int lineNo = 0;
            while ((line = br.readLine()) != null) {

                JSONObject obj;
                try {
                    obj = new JSONObject(line);
                } catch (Exception ex) {
                    throw new RuntimeException("Invalid journal file");
                }

                if (lineNo == 0) {
                    if (!obj.has("payload_sha256") || !(obj.has("hub_url"))) {
                        throw new RuntimeException("Invalid journal file");
                    }
                    
                    resumePayloadSha256 = obj.getString("payload_sha256");
                    resumeHubUrl = obj.getString("hub_url");
                } else {
                    journalEntries.add(obj);
                }

                lineNo++;
            }
        } catch (IOException ex) {
            throw new RuntimeException("Error reading journal file");
        }

        return journalEntries;
    }

    /**
     * Fetches available workspace names from the IA Hub.
     * @param iaHostUrl Base URL of the IA Hub.
     * @param oAuthToken OAuth bearer token.
     * @return set of workspace names.
     * @throws Exception if the HTTP request fails or parsing fails.
     */
    private Set<String> fetchWorkspaceNames(String iaHostUrl, String oAuthToken) throws Exception {
        Set<String> workspaceNames = new HashSet<>();

        Map<String, String> headers = new HashMap<>();
        headers.put(HttpHeaders.AUTHORIZATION, "Bearer " + oAuthToken);
        headers.put(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());
        headers.put(HttpHeaders.ACCEPT_ENCODING, "gzip");

        String url = iaHostUrl + workspacesUrlPath;

        HttpResult res = httpTransport.request("GET", url, headers, null);
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new RuntimeException("Failed to fetch Hub projects for resume validation. HTTP code: " + res.statusCode + "\nResponse: " + res.body);
        }

        JSONObject root = new JSONObject(res.body);
        if (root.has("items")) {
            JSONArray items = root.getJSONArray("items");
            for (int i = 0; i < items.length(); i++) {
                JSONObject workspace = items.getJSONObject(i);
                String name = workspace.getString("name");
                workspaceNames.add(name);
            }
        }

        return workspaceNames;
    }

    // Fetch projects (policy-model) and decision service projects (decision) from Hub, with versions in order
    /**
     * Fetches existing projects and decision service projects and their versions from the IA Hub.
     * @param iaHostUrl Base URL of the IA Hub.
     * @param oAuthToken OAuth bearer token.
     * @return map of project name to ordered versions.
     * @throws Exception if the HTTP request fails or parsing fails.
     */
    private Map<String, List<ProjectVersion>> fetchHubVersions(String iaHostUrl, String oAuthToken) throws Exception {
        String url = iaHostUrl + projectVersionsUrlPath;

        Map<String, String> headers = new HashMap<>();
        headers.put(HttpHeaders.AUTHORIZATION, "Bearer " + oAuthToken);
        headers.put(HttpHeaders.ACCEPT, ContentType.APPLICATION_JSON.getMimeType());
        headers.put(HttpHeaders.ACCEPT_ENCODING, "gzip");

        HttpResult res = httpTransport.request("GET", url, headers, null);
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new RuntimeException("Failed to fetch Hub projects for resume validation. HTTP code: " + res.statusCode + "\nResponse: " + res.body);
        }

        Map<String, List<ProjectVersion>> projectsByName = new HashMap<>();

        JSONObject root = new JSONObject(res.body);
        if (root.has("items")) {
            JSONArray items = root.getJSONArray("items");
            for (int i = 0; i < items.length(); i++) {
                JSONObject proj = items.getJSONObject(i);
                String name = proj.optString("name", null);
                String kind = proj.optString("kind", "");

                // Normalize kind to our importer terminology
                boolean isPolicyModel = "policy-model".equalsIgnoreCase(kind);
                boolean isDecision = "decision".equalsIgnoreCase(kind);

                JSONObject versionsObj = proj.optJSONObject("versions");
                if (versionsObj == null || !versionsObj.has("items")) continue;
                JSONArray versionsArr = versionsObj.getJSONArray("items");

                for (int v = 0; v < versionsArr.length(); v++) {
                    JSONObject ver = versionsArr.getJSONObject(v);
                    int versionNo = ver.getInt("version");
                    String description = ver.optString("description", null);
                    String descriptionUpdatedAt = ver.optString("descriptionUpdatedAt", null);
                    String descriptionAuthor = ver.optString("descriptionAuthor", null);
                    String author = ver.optString("author", null);
                    String createTimestamp = ver.optString("createTimestamp", null);
                    String fingerprintSha256 = ver.optString("definitionHash", null);

                    if (isPolicyModel) {
                        // Map to ProjectVersion (fields not present on Hub remain null)
                        OPMProjectVersion pv = new OPMProjectVersion(
                                name,
                                versionNo,
                                description,
                                author,
                                null,                 // opaVersion not provided by Projects API
                                createTimestamp,
                                descriptionUpdatedAt,
                                descriptionAuthor,
                                fingerprintSha256,                
                                null,
                                null
                        );
                        projectsByName.computeIfAbsent(name, k -> new ArrayList<>()).add(pv);
                    } else if (isDecision) {
                        // Map to ModuleVersion
                        String definition = ver.has("definition") ? ver.get("definition").toString() : null;
                        boolean isDraft = ver.getBoolean("isDraft");
                        DecisionServiceProjectVersion mv = new DecisionServiceProjectVersion(
                                name,
                                isDraft ? 0 : versionNo,
                                createTimestamp,
                                0,                    // moduleImported not on Projects API; set default
                                author,
                                definition,
                                description,
                                descriptionUpdatedAt,
                                descriptionAuthor,
                                fingerprintSha256
                        );
                        projectsByName.computeIfAbsent(name, k -> new ArrayList<>()).add(mv);
                    }
                }
            }
        }

        for (List<ProjectVersion> projectVersions : projectsByName.values()) {
            projectVersions.sort(Comparator.comparing(ProjectVersion::isDraft).thenComparingInt(ProjectVersion::getVersion));
        }

        return projectsByName;
    }

    // Generic HTTP utility for GET/POST requests
    /**
     * Simple HTTP result holder for status and body.
     */
    public static class HttpResult {
        final int statusCode;
        final String body;
        HttpResult(int statusCode, String body) {
            this.statusCode = statusCode;
            this.body = body != null ? body : "";
        }
    }

    /**
     * Default HTTP transport using Apache HttpClient.
     */
    private static class DefaultHttpTransport implements HttpTransport {
        /**
         * Delegates to the static httpRequest helper.
         */
        @Override
        public HttpResult request(String method, String url, Map<String, String> headers, String body) throws Exception {
            return httpRequest(method, url, headers, body);
        }
    }

    /**
     * Performs a GET or POST request and returns status/body.
     * @param method HTTP method to use.
     * @param url Target URL.
     * @param headers Request headers to include.
     * @param body Optional UTF-8 body for POST.
     * @return HTTP result containing status and body text.
     * @throws Exception if the HTTP client fails or the request cannot be executed.
     */
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

    /**
     * URL-encodes a string as UTF-8.
     * @param s String to encode.
     * @return encoded string.
     */
    private static String urlEncodeUtf8(String s) {
        try {
            return URLEncoder.encode(s, "UTF-8");
        } catch (java.io.UnsupportedEncodingException e) {
            throw new RuntimeException(e);
        }
    }

    // Helper method to read all bytes from an InputStream (replacement for StreamUtils.readAll)
    /**
     * Reads all bytes from the given input stream.
     * @param input Input stream to read.
     * @return byte array of all read data.
     * @throws IOException if an I/O error occurs.
     */
    private static byte[] readAllBytes(InputStream input) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        int nRead;
        byte[] data = new byte[4096];
        while ((nRead = input.read(data, 0, data.length)) != -1) {
            buffer.write(data, 0, nRead);
        }
        buffer.flush();
        return buffer.toByteArray();
    }
}
