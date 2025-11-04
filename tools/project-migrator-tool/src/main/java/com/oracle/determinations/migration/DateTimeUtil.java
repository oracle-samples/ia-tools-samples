package com.oracle.determinations.migration;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * Utilities for comparing ISO_OFFSET_DATE_TIME strings (e.g., 2025-11-04T12:34:56+10:00 or 2025-11-04T12:34:56Z).
 * Compares equality by Instant, accounting for timezone.
 */
public final class DateTimeUtil {

    private static final DateTimeFormatter ISO_OFFSET = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private DateTimeUtil() {}

    /**
     * Returns true if both date strings represent the same instant in time (accounting for timezone).
     * - If both are null: true
     * - If one is null: false
     * - Tries to parse both with ISO_OFFSET_DATE_TIME; if either is unparsable, treats them as equal (lenient)
     * - Otherwise compares their Instants
     */
    public static boolean sameInstant(String a, String b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;

        Instant ia = instantOrNull(a);
        Instant ib = instantOrNull(b);
        if (ia == null || ib == null) {
            return true;
        }
        return ia.equals(ib);
    }

    /**
     * Returns the Instant represented by the given date string, or null if it cannot be parsed.
     */
    public static Instant instantOrNull(String s) {
        if (s == null) return null;
        try {
            return OffsetDateTime.parse(s, ISO_OFFSET).toInstant();
        } catch (DateTimeParseException ex) {
            return null;
        }
    }
}
