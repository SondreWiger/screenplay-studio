package no.northem.screenplaystudio.data

import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/** Parses the timestamp shapes Postgres and PostgREST actually return. */
object PostgresDate {
    fun parse(raw: String): Instant? {
        var s = raw.trim()
        if (s.isEmpty()) return null
        if (Regex("[+-]\\d{2}$").containsMatchIn(s)) s += ":00"
        if (' ' in s && 'T' !in s) s = s.replace(' ', 'T')
        if ('T' in s && !s.endsWith("Z") && !Regex("[+-]\\d{2}:\\d{2}$").containsMatchIn(s)) s += "Z"
        return runCatching { OffsetDateTime.parse(s, DateTimeFormatter.ISO_OFFSET_DATE_TIME).toInstant() }
            .getOrElse {
                runCatching { LocalDate.parse(raw.trim()).atStartOfDay().toInstant(ZoneOffset.UTC) }.getOrNull()
            }
    }

    fun format(instant: Instant): String = DateTimeFormatter.ISO_INSTANT.format(instant)
}
