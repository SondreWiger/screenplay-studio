package no.northem.screenplaystudio.data

/**
 * A small, immutable PostgREST request builder — the Kotlin twin of
 * PostgrestQuery.swift. Only the operators the app uses.
 */
data class Query(
    val table: String,
    val method: String = "GET",
    val params: List<Pair<String, String>> = emptyList(),
    val body: String? = null,
    val prefer: List<String> = emptyList(),
    val range: String? = null,
) {
    fun select(columns: String = "*") = copy(params = params + ("select" to columns))
    fun eq(column: String, value: Any) = filter(column, "eq.$value")
    fun gte(column: String, value: String) = filter(column, "gte.$value")
    fun lte(column: String, value: String) = filter(column, "lte.$value")
    fun inList(column: String, values: List<String>) =
        filter(column, "in.(" + values.joinToString(",") { "\"" + it.replace("\"", "\\\"") + "\"" } + ")")
    fun or(expression: String) = copy(params = params + ("or" to "($expression)"))

    fun order(column: String, ascending: Boolean = true): Query {
        val term = "$column.${if (ascending) "asc" else "desc"}.nullslast"
        val existing = params.firstOrNull { it.first == "order" }
        return if (existing == null) copy(params = params + ("order" to term))
        else copy(params = params.map { if (it.first == "order") "order" to "${it.second},$term" else it })
    }

    fun limit(count: Int) = copy(params = params + ("limit" to count.toString()))
    fun range(from: Int, to: Int) = copy(range = "$from-$to")

    fun insert(json: String, returning: Boolean = true) =
        copy(method = "POST", body = json, prefer = prefer + returnPref(returning))

    fun upsert(json: String, onConflict: String = "id") =
        copy(
            method = "POST", body = json,
            params = params + ("on_conflict" to onConflict),
            prefer = prefer + "return=minimal" + "resolution=merge-duplicates",
        )

    fun update(json: String, returning: Boolean = false) =
        copy(method = "PATCH", body = json, prefer = prefer + returnPref(returning))

    fun delete() = copy(method = "DELETE", prefer = prefer + "return=minimal")

    /** Equality filters, for the debug demo transport. */
    val equalityFilters: List<Pair<String, String>>
        get() = params.filter { it.second.startsWith("eq.") && it.first !in RESERVED }
            .map { it.first to it.second.removePrefix("eq.") }

    private fun filter(column: String, expression: String) = copy(params = params + (column to expression))
    private fun returnPref(returning: Boolean) = if (returning) "return=representation" else "return=minimal"

    private companion object {
        val RESERVED = setOf("select", "order", "limit", "offset", "on_conflict", "or")
    }
}
