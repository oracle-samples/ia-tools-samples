package com.oracle.determinations.migration;

import org.json.JSONObject;

import java.io.BufferedWriter;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;

public class Journal implements AutoCloseable {
    private final FileOutputStream fos;
    private final BufferedWriter writer;

    public Journal(String path) throws java.io.IOException {
        this.fos = new FileOutputStream(path, true);
        this.writer = new BufferedWriter(new OutputStreamWriter(fos, StandardCharsets.UTF_8));
    }

    public synchronized void write(JSONObject obj) throws java.io.IOException {
        writer.write(obj.toString());
        writer.newLine();
        writer.flush();
        // Force data to disk to minimize loss if process terminates unexpectedly
        this.fos.getFD().sync();
    }

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
