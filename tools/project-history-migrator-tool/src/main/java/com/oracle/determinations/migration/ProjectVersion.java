/**
 * Copyright © 2025, Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
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
