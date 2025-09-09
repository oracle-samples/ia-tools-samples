package com.oracle.determinations.migration;

import java.io.BufferedOutputStream;
import java.io.FileOutputStream;
import java.util.zip.ZipOutputStream;

public class Main {
    public static void main(String[] args) {
        if (args.length < 1) {
            printUsage();
            return;
        }

        String mode = args[0].toLowerCase();

        switch (mode) {
            case "--export":
                // Expect: --export <dbUrl> <username> <password>
                if (args.length != 4) {
                    printUsage();
                    return;
                }
                String dbUrl = args[1];
                String username = args[2];
                String password = args[3];

                System.out.println("Export Mode Selected.");
                System.out.println("Database URL: " + dbUrl);
                System.out.println("Username: " + username);

                try {
                    Exporter exporter = new Exporter();
                    try (java.sql.Connection conn = exporter.establishConnection(dbUrl, username, password)) {
                        try (
                            FileOutputStream fos = new FileOutputStream("exported.zip");
                            BufferedOutputStream bos = new BufferedOutputStream(fos);
                            ZipOutputStream zos = new ZipOutputStream(bos)
                        ) {
                            exporter.doExport(conn, zos);
                            zos.flush();
                            System.out.println("Exported data to exported.zip");
                        }
                    }
                } catch (ClassNotFoundException e) {
                    System.err.println("JDBC Driver not found for URL: " + dbUrl + ". Ensure the appropriate MySQL or Oracle JDBC driver is on the classpath.");
                } catch (java.sql.SQLException e) {
                    System.err.println("Failed to connect to the database: " + e.getMessage());
                } catch (Exception e) {
                    e.printStackTrace();
                }
                break;
            case "--import":
                // Expect: --import <IAHostUrl> <username> <password> <exportedPayloadPath> [resumeJournalPath]
                if (args.length != 5 && args.length != 6) {
                    printUsage();
                    return;
                }
                String iaHostUrl = args[1];
                String iaUsername = args[2];
                String iaPassword = args[3];
                String exportedPayloadPath = args[4];
                String resumeJournalPath = args.length == 6 ? args[5] : null;

                System.out.println("Import Mode Selected.");
                System.out.println("Intelligent Advisor Host URL: " + iaHostUrl);
                System.out.println("Username: " + iaUsername);
                System.out.println("Password: (provided, hidden for security)");
                System.out.println("Exported Data Payload Path: " + exportedPayloadPath);
                if (resumeJournalPath != null) {
                    System.out.println("Resume Journal: " + resumeJournalPath);
                }

                try {
                    new Importer().doImport(iaHostUrl, iaUsername, iaPassword, exportedPayloadPath, resumeJournalPath);
                } catch (Exception e) {
                    e.printStackTrace();
                }
                break;
            default:
                printUsage();
                break;
        }
    }

    private static void printUsage() {
        System.out.println("Usage:");
        System.out.println("  java -jar project-migration-tool.jar --export <dbUrl> <username> <password>");
        System.out.println("      - Exports source database contents to exported.zip using the given database connection.");
        System.out.println();
        System.out.println("  java -jar project-migration-tool.jar --import <IAHostUrl> <API client identifier> <API client secret> <exportedPayloadPath> [resumeJournalPath]");
        System.out.println("      - Imports the exported.zip payload into the given Intelligent Advisor server.");
        System.out.println("      - If resumeJournalPath is provided, validates journal entries against the payload and resumes by skipping versions already imported.");
    }

    
}
