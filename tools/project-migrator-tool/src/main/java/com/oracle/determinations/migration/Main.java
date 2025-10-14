package com.oracle.determinations.migration;

import java.io.BufferedOutputStream;
import java.io.FileOutputStream;
import java.io.Console;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.util.zip.ZipOutputStream;

/**
 * CLI entry point for exporting from a database or importing into IA Hub.
 */
public class Main {
    /**
     * Application entry point.
     * @param args Command-line arguments. Use:
     *             --export <dbUrl> or --import <IAHostUrl> <exportedPayloadPath> [resumeJournalPath]
     */
    public static void main(String[] args) {
        try {
            if (args.length < 1) {
                printUsage();
                return;
            }

        String mode = args[0].toLowerCase();

        switch (mode) {
            case "--export":
                // Expect: --export <dbUrl>; db credentials read from stdin
                if (args.length != 2) {
                    printUsage();
                    return;
                }
                String dbUrl = args[1];
                String username = prompt("Database username: ");
                String password = promptPassword("Database password: ");

                System.out.println("Export Mode Selected.");
                System.out.println("Database URL: " + dbUrl);
                System.out.println("Database username: " + username);

                try {
                    Exporter exporter = new Exporter();
                    String exportZip = exporter.newExportZipFileName();
                    try (java.sql.Connection conn = exporter.establishConnection(dbUrl, username, password)) {
                        try (
                            FileOutputStream fos = new FileOutputStream(exportZip);
                            BufferedOutputStream bos = new BufferedOutputStream(fos);
                            ZipOutputStream zos = new ZipOutputStream(bos)
                        ) {
                            exporter.doExport(conn, zos);
                            zos.flush();
                            System.out.println("Exported data to " + exportZip);
                        }
                    }
                } catch (ClassNotFoundException e) {
                    System.err.println("JDBC Driver not found for URL: " + dbUrl + ". Ensure the appropriate MySQL or Oracle JDBC driver is on the classpath.");
                    System.exit(1);
                } catch (java.sql.SQLException e) {
                    System.err.println("Failed to connect to the database: " + e.getMessage());
                    System.exit(1);
                } catch (Exception e) {
                    System.err.println("Export failed: " + e.getMessage());
                    System.exit(1);
                }
                break;
            case "--import":
                // Expect: --import <IAHostUrl> <exportedPayloadPath> [resumeJournalPath]
                // API client identifier and secret read from stdin
                if (args.length != 3 && args.length != 4) {
                    printUsage();
                    return;
                }
                String iaHostUrl = args[1];
                if (iaHostUrl.endsWith("/")) {
                    iaHostUrl = iaHostUrl.substring(0, iaHostUrl.length() - 1);
                }

                String exportedPayloadPath = args[2];
                String resumeJournalPath = args.length == 4 ? args[3] : null;

                String iaClientId = prompt("API client identifier: ");
                String iaClientSecret = promptPassword("API client secret: ");

                System.out.println("Import Mode Selected.");
                System.out.println("Intelligent Advisor Host URL: " + iaHostUrl);
                System.out.println("API client identifier: " + iaClientId);
                System.out.println("API client secret: (provided, hidden for security)");
                System.out.println("Exported Data Payload Path: " + exportedPayloadPath);
                if (resumeJournalPath != null) {
                    System.out.println("Resume Journal: " + resumeJournalPath);
                }

                try {
                    new Importer().doImport(iaHostUrl, iaClientId, iaClientSecret, exportedPayloadPath, resumeJournalPath);
                } catch (Exception e) {
                    System.err.println("Import failed: " + e.getMessage());
                    System.exit(1);
                }
                break;
            default:
                printUsage();
                break;
        }
    } catch (Exception e) {
        System.err.println("Error: " + e.getMessage());
        System.exit(1);
    }
    
    }

    /**
     * Prompts the user for input and returns the trimmed response.
     * @param prompt Message to display.
     * @return trimmed input line (empty string if null).
     * @throws RuntimeException if reading from stdin fails.
     */
    private static String prompt(String prompt) {
        Console console = System.console();
        if (console != null) {
            String line = console.readLine("%s", prompt);
            return line != null ? line.trim() : "";
        }
        try {
            System.out.print(prompt);
            BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
            String line = br.readLine();
            return line != null ? line.trim() : "";
        } catch (IOException e) {
            throw new RuntimeException("Failed to read input from stdin", e);
        }
    }

    /**
     * Prompts the user for a password (masked when a console is available).
     * Falls back to visible input if no console is available.
     * @param prompt Message to display.
     * @return entered password string (may be empty).
     */
    private static String promptPassword(String prompt) {
        Console console = System.console();
        if (console != null) {
            char[] pwd = console.readPassword("%s", prompt);
            return pwd != null ? new String(pwd) : "";
        }
        // Fallback (visible) when no console is available, e.g., running in some IDEs
        return prompt(prompt);
    }

    /**
     * Prints usage information for the CLI.
     */
    private static void printUsage() {
        System.out.println("Usage:");
        System.out.println("  java -jar project-migrator-tool.jar --export <dbUrl>");
        System.out.println("      - Prompts for the database username and password via stdin.");
        System.out.println();
        System.out.println("  java -jar project-migrator-tool.jar --import <IAHostUrl> <exportedPayloadPath> [resumeJournalPath]");
        System.out.println("      - Prompts for the API client identifier and secret via stdin.");
        System.out.println("      - Imports the exported.zip payload into the given Intelligent Advisor server.");
        System.out.println("      - If resumeJournalPath is provided, validates journal entries against the payload and resumes by skipping versions already imported.");
    }
}
