package no.northem.screenplaystudio.ui.editor

import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.data.ElementType
import no.northem.screenplaystudio.data.Query
import no.northem.screenplaystudio.data.Repository
import no.northem.screenplaystudio.data.ScriptElement
import no.northem.screenplaystudio.data.Supabase
import no.northem.screenplaystudio.ui.friendly

enum class SaveState { SAVED, SAVING, OFFLINE, ERROR }

/**
 * The editor is a stack of typed elements, not one text field — that's what
 * makes real screenplay formatting possible. Each element knows its margins,
 * casing and what Return creates next, mirroring EditorViewModel.swift and the
 * web editor, so a script flows the same way on every platform.
 *
 * Nothing in the typing path waits on the network: edits land in memory at
 * once and are written behind a short debounce.
 */
class EditorViewModel(private val scriptId: String) : ViewModel() {

    val elements = mutableStateListOf<ScriptElement>()
    val loading = mutableStateOf(true)
    val error = mutableStateOf<String?>(null)
    val saveState = mutableStateOf(SaveState.SAVED)
    val focusId = mutableStateOf<String?>(null)
    /** Where the caret should land when [focusId] next takes focus. */
    var pendingCaret: Int? = null

    private val pending = mutableMapOf<String, Job>()
    private val cacheKey = Query("elements-$scriptId")

    init {
        Supabase.cached(cacheKey, ScriptElement.serializer())?.let {
            elements.addAll(it); loading.value = false
        }
        load()
    }

    fun load() = viewModelScope.launch {
        try {
            val rows = Repository.fetchElements(scriptId)
            Supabase.writeKeyed(cacheKey.table, rows, ScriptElement.serializer())
            // Never clobber a line that's mid-edit.
            if (pending.isEmpty()) {
                elements.clear()
                elements.addAll(rows)
            }
            if (elements.isEmpty()) addFirst()
            error.value = null
        } catch (e: Exception) {
            error.value = friendly(e)
            if (elements.isEmpty()) addFirst()
        } finally {
            loading.value = false
        }
    }

    private fun addFirst() {
        val first = ScriptElement(Repository.newElementId(), scriptId, ElementType.SCENE_HEADING.raw, "", 0.0)
        elements.add(first)
        insertRemote(first)
    }

    fun indexOf(id: String) = elements.indexOfFirst { it.id == id }

    fun edit(id: String, content: String) {
        val i = indexOf(id).takeIf { it >= 0 } ?: return
        if (elements[i].content == content) return
        elements[i] = elements[i].copy(content = content)
        scheduleSave(id)
    }

    fun setType(id: String, type: ElementType) {
        val i = indexOf(id).takeIf { it >= 0 } ?: return
        elements[i] = elements[i].copy(elementType = type.raw)
        write { Repository.updateElement(id, type = type.raw) }
    }

    /** Return: split at the caret; the tail becomes the next element. */
    fun split(id: String, before: String, after: String) {
        val i = indexOf(id).takeIf { it >= 0 } ?: return
        val current = elements[i]
        elements[i] = current.copy(content = before)
        scheduleSave(id, immediate = true)
        val next = ScriptElement(
            id = Repository.newElementId(),
            scriptId = scriptId,
            elementType = current.type.nextOnReturn.raw,
            content = after,
            sortOrder = sortOrderAfter(i),
        )
        elements.add(i + 1, next)
        insertRemote(next)
        pendingCaret = 0
        focusId.value = next.id
    }

    /** Backspace at the very start: merge into the element above. */
    fun mergeUp(id: String) {
        val i = indexOf(id).takeIf { it > 0 } ?: return
        val above = elements[i - 1]
        val current = elements[i]
        elements[i - 1] = above.copy(content = above.content + current.content)
        elements.removeAt(i)
        pending.remove(id)?.cancel()
        scheduleSave(above.id, immediate = true)
        write { Repository.deleteElement(id) }
        pendingCaret = above.content.length
        focusId.value = above.id
    }

    fun delete(id: String) {
        val i = indexOf(id).takeIf { it >= 0 } ?: return
        if (elements.size == 1) return edit(id, "")
        elements.removeAt(i)
        pending.remove(id)?.cancel()
        write { Repository.deleteElement(id) }
        focusId.value = elements.getOrNull((i - 1).coerceAtLeast(0))?.id
    }

    private fun sortOrderAfter(index: Int): Double {
        val here = elements[index].sortOrder
        val next = elements.getOrNull(index + 1)?.sortOrder
        return if (next != null && next > here) (here + next) / 2 else here + 1
    }

    private fun insertRemote(element: ScriptElement) = write { Repository.upsertElement(element) }

    private fun scheduleSave(id: String, immediate: Boolean = false) {
        pending[id]?.cancel()
        saveState.value = SaveState.SAVING
        pending[id] = viewModelScope.launch {
            if (!immediate) delay(800)
            val element = elements.firstOrNull { it.id == id } ?: return@launch
            try {
                // Upsert rather than patch: covers a line created offline whose
                // insert never reached the server.
                Repository.upsertElement(element)
                markSaved()
            } catch (e: Exception) {
                saveState.value = if (e is no.northem.screenplaystudio.data.SupabaseException && e.offline) SaveState.OFFLINE else SaveState.ERROR
                error.value = friendly(e)
            } finally {
                pending.remove(id)
            }
        }
    }

    private fun write(block: suspend () -> Unit) = viewModelScope.launch {
        saveState.value = SaveState.SAVING
        try { block(); markSaved() } catch (e: Exception) {
            saveState.value = if (e is no.northem.screenplaystudio.data.SupabaseException && e.offline) SaveState.OFFLINE else SaveState.ERROR
            error.value = friendly(e)
        }
    }

    private fun markSaved() {
        if (pending.isEmpty() || pending.values.all { it.isCompleted }) saveState.value = SaveState.SAVED
    }

    /** Flush anything still waiting on its debounce — on leaving the screen. */
    fun flush() {
        pending.keys.toList().forEach { scheduleSave(it, immediate = true) }
    }

    val sceneIndex: List<Pair<Int, String>>
        get() = elements.mapIndexedNotNull { i, e -> if (e.type == ElementType.SCENE_HEADING) i to e.content.ifBlank { "Untitled scene" } else null }

    val stats: String
        get() {
            val words = elements.sumOf { e -> e.content.split(Regex("\\s+")).count { it.isNotBlank() } }
            val scenes = elements.count { it.type == ElementType.SCENE_HEADING }
            // ~55 lines a page; a rough but familiar estimate.
            val pages = (elements.size * 1.6 / 55).coerceAtLeast(0.1)
            return "$scenes scenes · $words words · ~${"%.1f".format(pages)} pages"
        }
}
