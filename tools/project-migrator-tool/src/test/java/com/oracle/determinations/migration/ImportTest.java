package com.oracle.determinations.migration;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.Assert.*;

/**
 * Unit tests for the Importer, covering happy path, validation, auth, and resume logic.
 */
public class ImportTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    // Test helper: records requests and replays queued responses
    /**
     * Fake HTTP transport for tests: records requests and returns queued responses.
     */
    static class FakeHttpTransport implements Importer.HttpTransport {
        /**
         * Captured HTTP request details for assertions.
         */
        static class Request {
            final String method, url, body;
            final Map<String, String> headers;
            /**
             * Constructs a captured request.
             * @param method HTTP method.
             * @param url Target URL.
             * @param headers Request headers (copied).
             * @param body Request body string (may be null).
             */
            Request(String method, String url, Map<String, String> headers, String body) {
                this.method = method;
                this.url = url;
                this.headers = headers != null ? new HashMap<>(headers) : new HashMap<>();
                this.body = body;
            }
        }
        /**
         * Pre-canned HTTP response to be dequeued by the fake transport.
         */
        static class Response {
            final int status;
            final String body;
            /**
             * Constructs a fake response.
             * @param status HTTP status code.
             * @param body Response body.
             */
            Response(int status, String body) {
                this.status = status;
                this.body = body;
            }
        }

        final List<Request> requests = new ArrayList<>();
        final Deque<Response> responses = new ArrayDeque<>();

        /**
         * Enqueues a fake response to return for the next request.
         * @param status HTTP status code.
         * @param body Body text to return.
         */
        void addResponse(int status, String body) {
            responses.addLast(new Response(status, body));
        }

        /**
         * Returns all captured requests in order.
         * @return list of recorded requests.
         */
        List<Request> getRequests() {
            return requests;
        }

        @Override
        /**
         * Records the request and returns the next queued response or a default 200 {}.
         * @param method HTTP method.
         * @param url Target URL.
         * @param headers Headers to send.
         * @param body Optional body for POST.
         * @return result containing status code and body.
         */
        public Importer.HttpResult request(String method, String url, Map<String, String> headers, String body) {
            requests.add(new Request(method, url, headers, body));
            Response r = responses.isEmpty() ? new Response(200, "{}") : responses.removeFirst();
            return new Importer.HttpResult(r.status, r.body);
        }
    }

    // Override to control journal filename deterministically
    /**
     * Importer variant that writes to a deterministic journal path for tests.
     */
    static class TestImporter extends Importer {
        private final String journalPath;
        /**
         * Creates a test importer with injected seams and fixed journal path.
         * @param httpTransport fake HTTP transport.
         * @param journalFactory journal factory.
         * @param journalPath output path for the journal file.
         */
        public TestImporter(HttpTransport httpTransport, JournalFactory journalFactory, String journalPath) {
            super(httpTransport, journalFactory);
            this.journalPath = journalPath;
        }
        @Override
        /**
         * Uses a predictable journal file name in tests.
         * @return configured journal path.
         */
        protected String newJournalFileName() {
            return journalPath;
        }
    }

    // Utilities

    /**
     * Writes UTF-8 text content to a temp file.
     * @param name filename within the temp folder.
     * @param content string content to write.
     * @return the created File.
     * @throws Exception on I/O error.
     */
    private File writeTextFile(String name, String content) throws Exception {
        File f = tmp.newFile(name);
        try (BufferedWriter bw = new BufferedWriter(new FileWriter(f))) {
            bw.write(content);
        }
        return f;
    }

    /**
     * Builds a zip with text and binary entries.
     * @param name zip filename.
     * @param entries map of entryName -> text content (UTF-8).
     * @param binaryEntries map of entryName -> raw bytes.
     * @return the created zip File.
     * @throws Exception on I/O error.
     */
    private File buildZip(String name, Map<String, String> entries, Map<String, byte[]> binaryEntries) throws Exception {
        File zip = tmp.newFile(name);
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zip.toPath()))) {
            if (entries != null) {
                for (Map.Entry<String, String> e : entries.entrySet()) {
                    zos.putNextEntry(new ZipEntry(e.getKey()));
                    byte[] bytes = e.getValue().getBytes(StandardCharsets.UTF_8);
                    zos.write(bytes);
                    zos.closeEntry();
                }
            }
            if (binaryEntries != null) {
                for (Map.Entry<String, byte[]> e : binaryEntries.entrySet()) {
                    zos.putNextEntry(new ZipEntry(e.getKey()));
                    zos.write(e.getValue());
                    zos.closeEntry();
                }
            }
        }
        return zip;
    }

    /**
     * Creates a projects API response body with provided items array.
     * @param items array of project items.
     * @return JSON string.
     */
    private String hubProjectsResponse(JSONArray items) {
        JSONObject root = new JSONObject();
        root.put("items", items);
        return root.toString();
    }

    /**
     * Builds a project item with versions.
     * @param name project/module name.
     * @param kind policy-model or decision.
     * @param versionItems versions array.
     * @return JSON object.
     */
    private JSONObject hubProjectItem(String name, String kind, JSONArray versionItems) {
        JSONObject proj = new JSONObject();
        proj.put("name", name);
        proj.put("kind", kind);
        JSONObject versions = new JSONObject();
        versions.put("items", versionItems);
        proj.put("versions", versions);
        return proj;
    }

    /**
     * Builds a policy-model version object for the Hub response.
     * @param version version number.
     * @param author author name.
     * @param description version description.
     * @param createTimestamp timestamp string.
     * @param defHash definition hash.
     * @return JSON version object.
     */
    private JSONObject hubPolicyModelVersion(int version, String author, String description, String createTimestamp, String defHash) {
        JSONObject v = new JSONObject();
        v.put("version", version);
        v.put("author", author);
        v.put("description", description);
        v.put("createTimestamp", createTimestamp);
        v.put("definitionHash", defHash);
        // optional descriptionUpdatedAt, descriptionAuthor omitted
        return v;
    }

    /**
     * Builds a decision version object for the Hub response.
     * @param version version number.
     * @param isDraft whether this version is a draft.
     * @param author author name.
     * @param description version description.
     * @param createTimestamp timestamp string.
     * @param defHash definition hash.
     * @return JSON version object.
     */
    private JSONObject hubDecisionVersion(int version, boolean isDraft, String author, String description, String createTimestamp, String defHash) {
        JSONObject v = new JSONObject();
        v.put("version", version);
        v.put("isDraft", isDraft);
        v.put("author", author);
        v.put("description", description);
        v.put("createTimestamp", createTimestamp);
        v.put("definitionHash", defHash);
        // optional definition omitted
        return v;
    }

    /**
     * Creates a workspaces API response body with given workspace names.
     * @param names workspace names.
     * @return JSON string.
     */
    private String workspacesResponse(String... names) {
        JSONArray items = new JSONArray();
        for (String n : names) {
            JSONObject obj = new JSONObject();
            obj.put("name", n);
            items.put(obj);
        }
        JSONObject root = new JSONObject();
        root.put("items", items);
        return root.toString();
    }

    /**
     * Builds minimal payload entries for a mixed policy-model and decision module.
     * @param projectName name of the policy-model project.
     * @param workspace1 workspace for the project.
     * @param moduleName name of the decision module.
     * @param workspace2 workspace for the module.
     * @param fingerprint snapshot fingerprint entry name.
     * @return map of entry name to JSON string.
     */
    private Map<String, String> payloadEntriesForMixed(String projectName, String workspace1, String moduleName, String workspace2, String fingerprint) {
        // projects.json
        JSONArray projects = new JSONArray();
        JSONObject p = new JSONObject();
        p.put("project_name", projectName);
        p.put("workspace", workspace1);
        projects.put(p);

        // project_versions.json
        JSONArray projectVersions = new JSONArray();
        JSONObject pv = new JSONObject();
        pv.put("project_name", projectName);
        pv.put("project_version_number", 1);
        pv.put("description", "desc");
        pv.put("user_name", "user1");
        pv.put("opa_version", "12.2.39");
        pv.put("creation_date", "2024-01-01T00:00:00Z");
        pv.put("fingerprint_sha256", fingerprint);
        projectVersions.put(pv);

        // modules.json
        JSONArray modules = new JSONArray();
        JSONObject m = new JSONObject();
        m.put("module_name", moduleName);
        m.put("workspace", workspace2);
        modules.put(m);

        // module_versions.json
        JSONArray moduleVersions = new JSONArray();
        JSONObject mv = new JSONObject();
        mv.put("module_name", moduleName);
        mv.put("version_number", 1);
        mv.put("create_timestamp", "2024-02-01T00:00:00Z");
        mv.put("module_imported", 0);
        mv.put("user_name", "user2");
        mv.put("definition", "{\"dsl\":\"ok\"}");
        mv.put("fingerprint_sha256", "defhash");
        moduleVersions.put(mv);

        Map<String, String> jsons = new HashMap<>();
        jsons.put("projects.json", projects.toString());
        jsons.put("project_versions.json", projectVersions.toString());
        jsons.put("modules.json", modules.toString());
        jsons.put("module_versions.json", moduleVersions.toString());
        return jsons;
    }

    @Test
    /**
     * Verifies a mixed payload imports successfully and writes expected journal entries.
     * @throws Exception on unexpected failure.
     */
    public void testImportsMixedPayloadSuccessfully() throws Exception {
        String projectName = "PolicyA";
        String moduleName = "DecisionA";
        String ws1 = "WS1";
        String ws2 = "WS2";
        String fingerprint = "snap1";

        Map<String, String> entries = payloadEntriesForMixed(projectName, ws1, moduleName, ws2, fingerprint);
        Map<String, byte[]> bin = new HashMap<>();
        bin.put(fingerprint, "SNAPSHOT".getBytes(StandardCharsets.UTF_8));
        File zip = buildZip("payload.zip", entries, bin);

        // Prepare fake HTTP
        FakeHttpTransport http = new FakeHttpTransport();
        // 1) auth
        http.addResponse(200, new JSONObject().put("access_token", "token").toString());
        // 2) fetchHubVersions (empty)
        http.addResponse(200, hubProjectsResponse(new JSONArray()));
        // 3) fetch workspaces
        http.addResponse(200, workspacesResponse(ws1, ws2));
        // 4) POST OPM
        http.addResponse(201, "{}");
        // 5) POST Module
        http.addResponse(201, "{}");

        File journal = tmp.newFile("journal.json");
        // clean it so Importer appends to empty
        Files.write(journal.toPath(), new byte[0]);

        Importer imp = new TestImporter(http, Journal::new, journal.getAbsolutePath());
        imp.doImport("https://host", "user", "pass", zip.getAbsolutePath(), null);

        // Assert 5 requests made
        List<FakeHttpTransport.Request> reqs = http.getRequests();
        assertEquals(5, reqs.size());
        assertEquals("POST", reqs.get(0).method); // auth
        assertTrue(reqs.get(1).url.contains("/projects?expand=versions"));
        assertTrue(reqs.get(2).url.contains("/workspaces"));
        // The two uploads
        FakeHttpTransport.Request post1 = reqs.get(3);
        FakeHttpTransport.Request post2 = reqs.get(4);
        assertEquals("POST", post1.method);
        assertEquals("POST", post2.method);
        assertTrue(post1.url.contains("/opa-hub/api/experimental/migrate-opm-project-version"));
        assertTrue(post2.url.contains("/opa-hub/api/experimental/migrate-decision-service-project-version"));

        // Validate posted JSON bodies
        JSONObject body1 = new JSONObject(post1.body);
        assertEquals(projectName, body1.getString("project_name"));
        assertEquals(1, body1.getInt("project_version_number"));
        assertEquals(ws1, body1.getString("workspace"));
        assertTrue(body1.getJSONObject("snapshot").has("snapshot_base64"));

        JSONObject body2 = new JSONObject(post2.body);
        assertEquals(moduleName, body2.getString("module_name"));
        assertEquals(1, body2.getInt("version_number"));
        assertEquals(ws2, body2.getString("workspace"));
        assertEquals("{\"dsl\":\"ok\"}", body2.getString("definition"));
        assertFalse(body2.has("description")); // optional absent by our input

        // Validate journal: header + 2 entries
        List<String> lines = Files.readAllLines(journal.toPath(), StandardCharsets.UTF_8);
        assertEquals(3, lines.size());
        JSONObject header = new JSONObject(lines.get(0));
        assertEquals("https://host", header.getString("hub_url"));
        JSONObject e0 = new JSONObject(lines.get(1));
        JSONObject e1 = new JSONObject(lines.get(2));
        assertEquals(0, e0.getInt("index"));
        assertEquals(1, e1.getInt("index"));
    }

    @Test
    /**
     * Fails when project/module names already exist on the Hub.
     * @throws Exception on unexpected failure.
     */
    public void testFailsOnProjectNameClashes() throws Exception {
        String projectName = "ExistingProject";
        String moduleName = "ExistingModule";
        String ws = "WS1";
        String fingerprint = "fp";

        Map<String, String> entries = payloadEntriesForMixed(projectName, ws, moduleName, ws, fingerprint);
        Map<String, byte[]> bin = new HashMap<>();
        bin.put(fingerprint, "SNAP".getBytes(StandardCharsets.UTF_8));
        File zip = buildZip("payload.zip", entries, bin);

        FakeHttpTransport http = new FakeHttpTransport();
        // auth ok
        http.addResponse(200, new JSONObject().put("access_token", "t").toString());
        // fetchHubVersions returns names that will clash (must include at least one version)
        JSONArray items = new JSONArray();
        items.put(hubProjectItem(projectName, "policy-model", new JSONArray().put(hubPolicyModelVersion(1, "a", "d", "t", "h"))));
        items.put(hubProjectItem(moduleName, "decision", new JSONArray().put(hubDecisionVersion(1, false, "a", "d", "t", "h"))));
        http.addResponse(200, hubProjectsResponse(items));
        // workspaces won't be reached due to clash check, but provide anyway
        http.addResponse(200, workspacesResponse(ws));

        Importer imp = new TestImporter(http, Journal::new, tmp.newFile("j.json").getAbsolutePath());

        try {
            imp.doImport("https://host", "u", "p", zip.getAbsolutePath(), null);
            fail("Expected RuntimeException for name clashes");
        } catch (RuntimeException ex) {
            assertTrue(ex.getMessage().contains("already exist on the IA Hub"));
            assertTrue(ex.getMessage().contains(projectName));
            assertTrue(ex.getMessage().contains(moduleName));
        }
    }

    @Test
    /**
     * Fails when required workspaces are not present on the Hub.
     * @throws Exception on unexpected failure.
     */
    public void testFailsOnMissingWorkspaces() throws Exception {
        String projectName = "P1";
        String moduleName = "M1";
        String fingerprint = "f1";

        Map<String, String> entries = payloadEntriesForMixed(projectName, "WS_REQ_1", moduleName, "WS_REQ_2", fingerprint);
        Map<String, byte[]> bin = new HashMap<>();
        bin.put(fingerprint, "X".getBytes(StandardCharsets.UTF_8));
        File zip = buildZip("payload.zip", entries, bin);

        FakeHttpTransport http = new FakeHttpTransport();
        // auth ok
        http.addResponse(200, new JSONObject().put("access_token", "t").toString());
        // no existing projects
        http.addResponse(200, hubProjectsResponse(new JSONArray()));
        // workspaces response missing required ones
        http.addResponse(200, workspacesResponse("WS_OTHER"));

        Importer imp = new TestImporter(http, Journal::new, tmp.newFile("j.json").getAbsolutePath());

        try {
            imp.doImport("https://host", "u", "p", zip.getAbsolutePath(), null);
            fail("Expected RuntimeException for missing workspaces");
        } catch (RuntimeException ex) {
            assertTrue(ex.getMessage().contains("Target hub is missing workspaces"));
            assertTrue(ex.getMessage().contains("WS_REQ_1"));
            assertTrue(ex.getMessage().contains("WS_REQ_2"));
        }
    }

    @Test
    /**
     * Resume should fail if journal payload hash does not match the payload.
     * @throws Exception on unexpected failure.
     */
    public void testResumeJournalPayloadShaMismatch() throws Exception {
        // Minimal payload: one project with fingerprint
        String fingerprint = "f1";
        Map<String, String> entries = payloadEntriesForMixed("P1", "WS", "M1", "WS", fingerprint);
        Map<String, byte[]> bin = new HashMap<>();
        bin.put(fingerprint, "X".getBytes(StandardCharsets.UTF_8));
        File zip = buildZip("payload.zip", entries, bin);

        // Create a resume journal with mismatching sha
        File resume = tmp.newFile("resume.json");
        JSONObject header = new JSONObject();
        header.put("payload_sha256", "NOT_MATCHING");
        header.put("hub_url", "https://host");
        Files.write(resume.toPath(), (header.toString() + "\n").getBytes(StandardCharsets.UTF_8));

        FakeHttpTransport http = new FakeHttpTransport();
        // auth ok
        http.addResponse(200, new JSONObject().put("access_token", "t").toString());
        // fetchHubVersions ok (won't reach mismatch until after this call)
        http.addResponse(200, hubProjectsResponse(new JSONArray()));

        Importer imp = new TestImporter(http, Journal::new, tmp.newFile("j.json").getAbsolutePath());

        try {
            imp.doImport("https://host", "u", "p", zip.getAbsolutePath(), resume.getAbsolutePath());
            fail("Expected RuntimeException for journal payload mismatch");
        } catch (RuntimeException ex) {
            assertTrue(ex.getMessage().contains("Journal file does not match payload"));
        }
    }

    @Test
    /**
     * Resume should fail if journal hub URL does not match the target IA host.
     * @throws Exception on unexpected failure.
     */
    public void testResumeJournalHubUrlMismatch() throws Exception {
        String fingerprint = "f2";
        Map<String, String> entries = payloadEntriesForMixed("P1", "WS", "M1", "WS", fingerprint);
        Map<String, byte[]> bin = new HashMap<>();
        bin.put(fingerprint, "X".getBytes(StandardCharsets.UTF_8));
        File zip = buildZip("payload.zip", entries, bin);

        File resume = tmp.newFile("resume.json");
        JSONObject header = new JSONObject();
        header.put("payload_sha256", sha256OfFile(zip));
        header.put("hub_url", "https://DIFFERENT");
        Files.write(resume.toPath(), (header.toString() + "\n").getBytes(StandardCharsets.UTF_8));

        FakeHttpTransport http = new FakeHttpTransport();
        http.addResponse(200, new JSONObject().put("access_token", "t").toString());
        http.addResponse(200, hubProjectsResponse(new JSONArray()));

        Importer imp = new TestImporter(http, Journal::new, tmp.newFile("j.json").getAbsolutePath());
        try {
            imp.doImport("https://host", "u", "p", zip.getAbsolutePath(), resume.getAbsolutePath());
            fail("Expected RuntimeException for hub url mismatch");
        } catch (RuntimeException ex) {
            assertTrue(ex.getMessage().contains("Journal file does not match specified IA Hub"));
        }
    }

    @Test
    /**
     * Auth 200 response without access_token should be treated as an error.
     * @throws Exception on unexpected failure.
     */
    public void testAuthSuccessMissingAccessToken() throws Exception {
        String fingerprint = "f3";
        Map<String, String> entries = payloadEntriesForMixed("P1", "WS", "M1", "WS", fingerprint);
        Map<String, byte[]> bin = new HashMap<>();
        bin.put(fingerprint, "X".getBytes(StandardCharsets.UTF_8));
        File zip = buildZip("payload.zip", entries, bin);

        FakeHttpTransport http = new FakeHttpTransport();
        // auth returns 200 without access_token
        http.addResponse(200, "{}");

        Importer imp = new TestImporter(http, Journal::new, tmp.newFile("j.json").getAbsolutePath());
        try {
            imp.doImport("https://host", "u", "p", zip.getAbsolutePath(), null);
            fail("Expected RuntimeException for missing access_token");
        } catch (RuntimeException ex) {
            assertTrue(ex.getMessage().contains("Authentication succeeded but access_token not found"));
        }
    }

    @Test
    /**
     * Non-2xx auth responses should cause an authentication error.
     * @throws Exception on unexpected failure.
     */
    public void testAuthNon2xxFailure() throws Exception {
        String fingerprint = "f4";
        Map<String, String> entries = payloadEntriesForMixed("P1", "WS", "M1", "WS", fingerprint);
        Map<String, byte[]> bin = new HashMap<>();
        bin.put(fingerprint, "X".getBytes(StandardCharsets.UTF_8));
        File zip = buildZip("payload.zip", entries, bin);

        FakeHttpTransport http = new FakeHttpTransport();
        // auth fails
        http.addResponse(401, "{\"error\":\"bad creds\"}");

        Importer imp = new TestImporter(http, Journal::new, tmp.newFile("j.json").getAbsolutePath());
        try {
            imp.doImport("https://host", "u", "p", zip.getAbsolutePath(), null);
            fail("Expected RuntimeException for auth failure");
        } catch (RuntimeException ex) {
            assertTrue(ex.getMessage().contains("Authentication failed"));
            assertTrue(ex.getMessage().contains("401"));
        }
    }

    @Test
    /**
     * Resuming should replay prior entries and continue with remaining items.
     * @throws Exception on unexpected failure.
     */
    public void testResumeReplaysEntriesAndContinues() throws Exception {
        String projectName = "P1";
        String moduleName = "M1";
        String ws = "WS";
        String fingerprint = "f5";

        Map<String, String> entries = payloadEntriesForMixed(projectName, ws, moduleName, ws, fingerprint);
        Map<String, byte[]> bin = new HashMap<>();
        bin.put(fingerprint, "X".getBytes(StandardCharsets.UTF_8));
        File zip = buildZip("payload.zip", entries, bin);

        // Resume with one prior entry (index 0)
        File resume = tmp.newFile("resume.json");
        String header = new JSONObject().put("payload_sha256", sha256OfFile(zip)).put("hub_url", "https://host").toString();
        String priorEntry = new JSONObject().put("index", 0).put("project_name", projectName).put("type", "policy-model").put("version_number", 1).toString();
        Files.write(resume.toPath(), (header + "\n" + priorEntry + "\n").getBytes(StandardCharsets.UTF_8));

        FakeHttpTransport http = new FakeHttpTransport();
        // auth ok
        http.addResponse(200, new JSONObject().put("access_token", "t").toString());
        // fetchHubVersions returns that P1 v1 exists so resume validation passes (match payload fields for equals())
        JSONArray items = new JSONArray();
        items.put(hubProjectItem(projectName, "policy-model", new JSONArray().put(hubPolicyModelVersion(1, "user1", "desc", "t", "f5"))));
        http.addResponse(200, hubProjectsResponse(items));
        // Only remaining import is module M1
        http.addResponse(201, "{}"); // POST module

        File journalOut = tmp.newFile("journal-resume.json");
        Importer imp = new TestImporter(http, Journal::new, journalOut.getAbsolutePath());

        imp.doImport("https://host", "u", "p", zip.getAbsolutePath(), resume.getAbsolutePath());

        // Requests: POST auth, GET projects, POST module (workspaces not called in resume path)
        List<FakeHttpTransport.Request> reqs = http.getRequests();
        assertEquals(3, reqs.size());
        assertEquals("POST", reqs.get(0).method);
        assertTrue(reqs.get(1).url.contains("/projects?expand=versions"));
        assertEquals("POST", reqs.get(2).method);
        assertTrue(reqs.get(2).url.contains("/opa-hub/api/experimental/migrate-decision-service-project-version")); // module uses same path per current code

        // Journal should contain header + prior entry + new entry
        List<String> lines = Files.readAllLines(journalOut.toPath(), StandardCharsets.UTF_8);
        assertEquals(3, lines.size());
        JSONObject newEntry = new JSONObject(lines.get(2));
        assertEquals(1, newEntry.getInt("index"));
        assertEquals("decision", newEntry.getString("type"));
        assertEquals(moduleName, newEntry.getString("project_name"));
    }

    // Helper: compute sha256 of a file via Java (matches main code semantics)
    /**
     * Computes SHA-256 of a file for tests.
     * @param file target file.
     * @return lowercase hex digest.
     * @throws Exception if reading the file or digesting fails.
     */
    private String sha256OfFile(File file) throws Exception {
        byte[] bytes = Files.readAllBytes(file.toPath());
        // Lightweight inline SHA-256 to avoid adding dependencies in test; not strictly needed for speed
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
        byte[] digest = md.digest(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : digest) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
