package com.oracle.determinations.migration;

/**
 * Common metadata for a project version.
 */
public interface ProjectVersion {

    /**
     * Returns the version number.
     */
    int getVersion();
    /**
     * Returns the project name.
     */
    String getProjectName();

    /**
     * True if this version is a draft (unreleased).
     */
    boolean isDraft();
}
