/**
 * Copyright © 2025, Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
package com.oracle.determinations.migration;

import org.json.JSONObject;

import java.io.BufferedWriter;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;

/**
 * Append-only UTF-8 journal that writes one JSON object (or string) per line.
 * Ensures data is flushed and synced to disk to minimize loss on failure.
 */
public class Journal implements AutoCloseable {
    private final FileOutputStream fos;
    private final BufferedWriter writer;

    /**
     * Creates a journal appending to the given file path.
     * @param path file path to write journal entries to.
     * @throws java.io.IOException if the file cannot be opened for append.
     */
    public Journal(String path) throws java.io.IOException {
        this.fos = new FileOutputStream(path, true);
        this.writer = new BufferedWriter(new OutputStreamWriter(fos, StandardCharsets.UTF_8));
    }

    /**
     * Writes a JSON object as a single line entry.
     * @param obj JSON object to write.
     * @throws java.io.IOException if an I/O error occurs.
     */
    public synchronized void write(JSONObject obj) throws java.io.IOException {
        write(obj.toString());
    }

    /**
     * Writes a raw string as a single line entry and fsyncs the file.
     * @param str line to write (a newline will be appended).
     * @throws java.io.IOException if an I/O error occurs.
     */
    public synchronized void write(String str) throws java.io.IOException {
        writer.write(str);
        writer.newLine();
        writer.flush();
        // Force data to disk to minimize loss if process terminates unexpectedly
        this.fos.getFD().sync();
    }

    /**
     * Flushes, fsyncs, and closes the underlying streams.
     * @throws java.io.IOException if closing or syncing fails.
     */
    @Override
    public void close() throws java.io.IOException {
        try {
            writer.flush();
            this.fos.getFD().sync();
        } finally {
            writer.close();
            fos.close();
        }
    }
}
