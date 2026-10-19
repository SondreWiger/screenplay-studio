package no.northem.screenplaystudio.ui.documents

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.outlined.Article
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.CreateNewFolder
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.FormatListNumbered
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.LocalLibrary
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.data.DocumentType
import no.northem.screenplaystudio.data.PostgresDate
import no.northem.screenplaystudio.data.ProjectDocument
import no.northem.screenplaystudio.data.ProjectFolder
import no.northem.screenplaystudio.data.Repository
import no.northem.screenplaystudio.data.Supabase
import no.northem.screenplaystudio.data.SupabaseException
import no.northem.screenplaystudio.data.SyncQueue
import no.northem.screenplaystudio.ui.ProjectMemory
import no.northem.screenplaystudio.ui.SSTopBar
import no.northem.screenplaystudio.ui.components.Chip
import no.northem.screenplaystudio.ui.components.EmptyState
import no.northem.screenplaystudio.ui.components.FilterPill
import no.northem.screenplaystudio.ui.components.IconTile
import no.northem.screenplaystudio.ui.components.PrimaryButton
import no.northem.screenplaystudio.ui.components.SSCard
import no.northem.screenplaystudio.ui.components.SectionHeader
import no.northem.screenplaystudio.ui.components.SkeletonList
import no.northem.screenplaystudio.ui.editor.SaveState
import no.northem.screenplaystudio.ui.friendly
import no.northem.screenplaystudio.ui.projects.ConfirmDialog
import no.northem.screenplaystudio.ui.projects.SSSheet
import no.northem.screenplaystudio.ui.projects.SheetField
import no.northem.screenplaystudio.ui.relativeTime
import no.northem.screenplaystudio.ui.theme.SS
import java.time.Instant

/** Documents and folders for one project — DocumentsViewModel.swift. */
class DocumentsViewModel(private val projectId: String) : ViewModel() {
    val documents = MutableStateFlow(Supabase.cached(Repository.documentsQuery(projectId), ProjectDocument.serializer()))
    val folders = MutableStateFlow(Supabase.cached(Repository.foldersQuery(projectId), ProjectFolder.serializer()).orEmpty())
    val error = MutableStateFlow<String?>(null)
    val saveState = MutableStateFlow(SaveState.SAVED)

    init {
        refresh()
        viewModelScope.launch {
            SyncQueue.pending.collect { if (it.isEmpty() && saveState.value == SaveState.OFFLINE) saveState.value = SaveState.SAVED }
        }
    }

    fun refresh() = viewModelScope.launch {
        runCatching {
            folders.value = Repository.fetchFolders(projectId)
            documents.value = Repository.fetchDocuments(projectId)
            error.value = null
        }.onFailure { error.value = friendly(it); if (documents.value == null) documents.value = emptyList() }
    }

    private fun replace(id: String, change: (ProjectDocument) -> ProjectDocument) =
        documents.update { list -> list?.map { if (it.id == id) change(it) else it } }

    suspend fun create(title: String, type: DocumentType, folderId: String?): ProjectDocument? {
        val doc = Repository.createDocument(projectId, title, type, folderId) ?: return null
        documents.update { listOf(doc) + it.orEmpty() }
        return doc
    }

    suspend fun createFolder(name: String) {
        val order = (folders.value.maxOfOrNull { it.sortOrder ?: 0 } ?: -1) + 1
        Repository.createFolder(projectId, name, order)?.let { f -> folders.update { it + f } }
    }

    /** Autosave from the editor. The list updates at once; the write follows. */
    fun save(id: String, title: String?, content: String?) = viewModelScope.launch {
        replace(id) { d ->
            d.copy(title = title ?: d.title, content = content ?: d.content, updatedAt = PostgresDate.format(Instant.now()))
        }
        saveState.value = SaveState.SAVING
        try {
            val sent = Repository.saveDocument(id, title = title, content = content)
            saveState.value = if (sent) SaveState.SAVED else SaveState.OFFLINE
        } catch (e: Exception) {
            saveState.value = if (e is SupabaseException && e.offline) SaveState.OFFLINE else SaveState.ERROR
            error.value = friendly(e)
        }
    }

    fun togglePinned(doc: ProjectDocument) = viewModelScope.launch {
        val before = documents.value
        replace(doc.id) { it.copy(isPinned = !doc.pinned) }
        runCatching { Repository.setDocumentPinned(doc.id, !doc.pinned) }.onFailure { documents.value = before; error.value = friendly(it) }
    }

    fun move(doc: ProjectDocument, folderId: String?) = viewModelScope.launch {
        val before = documents.value
        replace(doc.id) { it.copy(folderId = folderId) }
        runCatching { Repository.moveDocument(doc.id, folderId) }.onFailure { documents.value = before; error.value = friendly(it) }
    }

    fun delete(doc: ProjectDocument) = viewModelScope.launch {
        val before = documents.value
        documents.update { list -> list?.filterNot { it.id == doc.id } }
        runCatching { Repository.deleteDocument(doc.id) }.onFailure { documents.value = before; error.value = friendly(it) }
    }

    /** Documents in a deleted folder stay in the project, loose. */
    fun deleteFolder(folder: ProjectFolder) = viewModelScope.launch {
        val beforeFolders = folders.value
        val beforeDocs = documents.value
        folders.update { list -> list.filterNot { it.id == folder.id } }
        documents.update { list -> list?.map { if (it.folderId == folder.id) it.copy(folderId = null) else it } }
        runCatching { Repository.deleteFolder(folder.id) }.onFailure {
            folders.value = beforeFolders; documents.value = beforeDocs; error.value = friendly(it)
        }
    }
}

val DocumentType.icon: ImageVector
    get() = when (this) {
        DocumentType.SCRIPT_NOTES -> Icons.Outlined.EditNote
        DocumentType.TREATMENT -> Icons.Outlined.Article
        DocumentType.OUTLINE -> Icons.Outlined.FormatListNumbered
        DocumentType.RESEARCH -> Icons.Outlined.LocalLibrary
        DocumentType.MEETING_NOTES -> Icons.Outlined.Forum
        DocumentType.CALL_SHEET -> Icons.Outlined.Call
        DocumentType.SHOT_LIST -> Icons.Outlined.PhotoCamera
        DocumentType.SCHEDULE -> Icons.Outlined.CalendarMonth
        DocumentType.DOCUMENT -> Icons.Outlined.Description
    }

private val DocumentType.tint: Color
    get() = when (this) {
        DocumentType.SCRIPT_NOTES -> SS.Brand400
        DocumentType.TREATMENT -> Color(0xFF8B5CF6)
        DocumentType.OUTLINE -> Color(0xFF06B6D4)
        DocumentType.RESEARCH -> Color(0xFF22C55E)
        DocumentType.MEETING_NOTES -> Color(0xFFEC4899)
        DocumentType.CALL_SHEET -> SS.warning
        DocumentType.SHOT_LIST -> Color(0xFF3B82F6)
        DocumentType.SCHEDULE -> SS.success
        DocumentType.DOCUMENT -> SS.textSecondary
    }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentsScreen(projectId: String, onBack: () -> Unit, initialDocumentId: String? = null) {
    val vm: DocumentsViewModel = viewModel(key = "documents-$projectId") { DocumentsViewModel(projectId) }
    val documents by vm.documents.collectAsStateWithLifecycle()
    val folders by vm.folders.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var selectedId by rememberSaveable { mutableStateOf(initialDocumentId) }
    var folderFilter by rememberSaveable { mutableStateOf<String?>(null) }
    var adding by remember { mutableStateOf(false) }
    var addingFolder by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<ProjectDocument?>(null) }
    var deletingFolder by remember { mutableStateOf<ProjectFolder?>(null) }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val twoPane = maxWidth >= 840.dp
        // A tablet always shows a document beside the list: the pinned one first.
        val selected = documents?.firstOrNull { it.id == selectedId }
            ?: if (twoPane) documents?.let { list -> list.firstOrNull { it.pinned } ?: list.firstOrNull() } else null

        if (!twoPane && selected != null) {
            BackHandler { selectedId = null }
            DocumentEditor(selected, vm, onBack = { selectedId = null }, onDelete = { deleting = selected })
            deleting?.let { doc ->
                ConfirmDialog("Delete \"${doc.resolvedTitle}\"?", "It's removed for everyone on the project.", "Delete",
                    onConfirm = { vm.delete(doc); deleting = null; selectedId = null }, onDismiss = { deleting = null })
            }
            return@BoxWithConstraints
        }

        Scaffold(
            containerColor = SS.background,
            topBar = {
                SSTopBar("Documents", onBack, subtitle = documents?.let { "${it.size} document${if (it.size == 1) "" else "s"}" }
                    ?: ProjectMemory.byId[projectId]?.title) {
                    IconButton(onClick = { addingFolder = true }) { Icon(Icons.Outlined.CreateNewFolder, "New folder", tint = SS.textSecondary) }
                }
            },
            floatingActionButton = {
                FloatingActionButton(onClick = { adding = true }, containerColor = SS.accent, contentColor = Color.White) {
                    Icon(Icons.Filled.Add, "New document")
                }
            },
        ) { padding ->
            Row(Modifier.fillMaxSize().padding(padding)) {
                PullToRefreshBox(false, { vm.refresh() }, Modifier.then(if (twoPane) Modifier.width(420.dp) else Modifier.weight(1f)).fillMaxHeight()) {
                    DocumentList(
                        documents, folders, error, folderFilter,
                        selectedId = selected?.id.takeIf { twoPane },
                        onFilter = { folderFilter = it },
                        onOpen = { selectedId = it.id },
                        onPin = vm::togglePinned,
                        onMove = vm::move,
                        onDelete = { deleting = it },
                        onDeleteFolder = { deletingFolder = it },
                    )
                }
                if (twoPane) {
                    Box(Modifier.weight(1f).fillMaxHeight().background(SS.S900.copy(alpha = 0.5f))) {
                        if (selected != null) DocumentEditor(selected, vm, onBack = null, onDelete = { deleting = selected })
                        else EmptyState(Icons.Outlined.Description, "No document open", "Treatments, notes and research open here, side by side with the list.")
                    }
                }
            }
        }
    }

    if (adding) NewDocumentSheet(folders, folderFilter, { adding = false }) { title, type, folder ->
        vm.create(title, type, folder)?.let { selectedId = it.id }
    }
    if (addingFolder) NewFolderSheet({ addingFolder = false }, vm::createFolder)
    deleting?.let { doc ->
        ConfirmDialog("Delete \"${doc.resolvedTitle}\"?", "It's removed for everyone on the project.", "Delete",
            onConfirm = { vm.delete(doc); deleting = null; if (selectedId == doc.id) selectedId = null }, onDismiss = { deleting = null })
    }
    deletingFolder?.let { folder ->
        ConfirmDialog("Delete folder \"${folder.name}\"?", "The documents in it stay in the project.", "Delete folder",
            onConfirm = { vm.deleteFolder(folder); deletingFolder = null; folderFilter = null }, onDismiss = { deletingFolder = null })
    }
}

@Composable
private fun DocumentList(
    documents: List<ProjectDocument>?,
    folders: List<ProjectFolder>,
    error: String?,
    folderFilter: String?,
    selectedId: String?,
    onFilter: (String?) -> Unit,
    onOpen: (ProjectDocument) -> Unit,
    onPin: (ProjectDocument) -> Unit,
    onMove: (ProjectDocument, String?) -> Unit,
    onDelete: (ProjectDocument) -> Unit,
    onDeleteFolder: (ProjectFolder) -> Unit,
) {
    val folder = folders.firstOrNull { it.id == folderFilter }
    val visible = documents?.filter { folder == null || it.folderId == folder.id }
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        LazyColumn(
            Modifier.widthIn(max = SS.readableWidth).fillMaxSize(),
            contentPadding = PaddingValues(start = SS.screenPadding, end = SS.screenPadding, top = 4.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(SS.rowSpacing),
        ) {
            error?.let { item { Text(it, color = SS.warning, style = MaterialTheme.typography.bodySmall) } }
            if (folders.isNotEmpty()) item {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterPill("All", folder == null, SS.accent) { onFilter(null) }
                    folders.forEach { f ->
                        val count = documents?.count { it.folderId == f.id } ?: 0
                        FilterPill("${f.name} · $count", folder?.id == f.id, SS.accent) { onFilter(f.id) }
                    }
                }
            }
            when {
                visible == null -> item { SkeletonList(4) }
                visible.isEmpty() -> item {
                    if (folder != null) {
                        EmptyState(Icons.Outlined.Folder, "Nothing in ${folder.name}", "Move documents here from their menu.", "Delete folder") { onDeleteFolder(folder) }
                    } else {
                        EmptyState(Icons.Outlined.Description, "No documents yet", "Treatments, director's notes, research and meeting notes — everything that isn't the script.")
                    }
                }
                else -> {
                    val pinned = if (folder == null) visible.filter { it.pinned } else emptyList()
                    if (pinned.isNotEmpty()) {
                        item { SectionHeader("Pinned") }
                        items(pinned, key = { "p-" + it.id }) { DocumentRow(it, folders, it.id == selectedId, onOpen, onPin, onMove, onDelete) }
                    }
                    val rest = visible - pinned.toSet()
                    if (rest.isNotEmpty()) {
                        item { SectionHeader(folder?.name ?: if (pinned.isEmpty()) "All documents" else "Everything else", "${rest.size} document${if (rest.size == 1) "" else "s"}") }
                        items(rest, key = { it.id }) { DocumentRow(it, folders, it.id == selectedId, onOpen, onPin, onMove, onDelete) }
                    }
                }
            }
        }
    }
}

@Composable
private fun DocumentRow(
    doc: ProjectDocument,
    folders: List<ProjectFolder>,
    selected: Boolean,
    onOpen: (ProjectDocument) -> Unit,
    onPin: (ProjectDocument) -> Unit,
    onMove: (ProjectDocument, String?) -> Unit,
    onDelete: (ProjectDocument) -> Unit,
) {
    var menu by remember { mutableStateOf(false) }
    SSCard(
        modifier = if (selected) Modifier.border(1.5.dp, SS.accent, RoundedCornerShape(SS.radius)) else Modifier,
        onClick = { onOpen(doc) },
        padding = PaddingValues(start = 14.dp, top = 12.dp, bottom = 12.dp, end = 4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconTile(doc.type.icon, doc.type.tint)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (doc.pinned) Icon(Icons.Filled.PushPin, "Pinned", tint = SS.accent, modifier = Modifier.padding(end = 4.dp).width(14.dp))
                    Text(doc.resolvedTitle, style = MaterialTheme.typography.titleMedium, color = SS.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Text(
                    listOfNotNull(doc.type.label, "${doc.wordCount} words", doc.updated?.let(::relativeTime)).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall, color = SS.textTertiary, maxLines = 1,
                )
            }
            Box {
                IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, "Document actions", tint = SS.textTertiary) }
                DropdownMenu(menu, { menu = false }, containerColor = SS.elevated) {
                    DropdownMenuItem({ Text(if (doc.pinned) "Unpin" else "Pin to top") }, { menu = false; onPin(doc) })
                    folders.filter { it.id != doc.folderId }.forEach { f ->
                        DropdownMenuItem({ Text("Move to ${f.name}") }, { menu = false; onMove(doc, f.id) })
                    }
                    if (doc.folderId != null) DropdownMenuItem({ Text("Move out of folder") }, { menu = false; onMove(doc, null) })
                    DropdownMenuItem({ Text("Delete", color = SS.danger) }, { menu = false; onDelete(doc) })
                }
            }
        }
    }
}

/**
 * A plain-text editor with autosave — DocumentEditorView.swift. Typing never
 * waits on the network: text lives here, and a write follows 800 ms after the
 * last keystroke (or when the editor closes), queued if the device is offline.
 */
@Composable
private fun DocumentEditor(doc: ProjectDocument, vm: DocumentsViewModel, onBack: (() -> Unit)?, onDelete: () -> Unit) {
    var title by remember(doc.id) { mutableStateOf(doc.title) }
    var text by remember(doc.id) { mutableStateOf(doc.content.orEmpty()) }
    var saved by remember(doc.id) { mutableStateOf(doc.title to doc.content.orEmpty()) }
    val saveState by vm.saveState.collectAsStateWithLifecycle()

    fun flush() {
        val (savedTitle, savedText) = saved
        if (title == savedTitle && text == savedText) return
        vm.save(doc.id, title.takeIf { it != savedTitle }, text.takeIf { it != savedText })
        saved = title to text
    }
    val latestFlush by rememberUpdatedState(::flush)

    LaunchedEffect(doc.id, title, text) {
        delay(800)
        latestFlush()
    }
    DisposableEffect(doc.id) { onDispose { latestFlush() } }

    val words = text.split(Regex("\\s+")).count { it.isNotBlank() }
    val status = when (saveState) {
        SaveState.SAVING -> "Saving…"
        SaveState.OFFLINE -> "Saved on this device — syncs when online"
        SaveState.ERROR -> "Couldn't save"
        SaveState.SAVED -> if (saved == (title to text)) "Saved" else "Editing"
    }

    Scaffold(
        containerColor = if (onBack == null) Color.Transparent else SS.background,
        topBar = {
            if (onBack != null) SSTopBar(title.ifBlank { "Untitled" }, onBack = { flush(); onBack() }, subtitle = status) {
                IconButton(onClick = onDelete) { Icon(Icons.Outlined.Delete, "Delete document", tint = SS.textSecondary) }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).imePadding(), contentAlignment = Alignment.TopCenter) {
            Column(
                Modifier.widthIn(max = SS.readableWidth).fillMaxSize().verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp, vertical = 16.dp),
            ) {
                BasicTextField(
                    value = title,
                    onValueChange = { title = it },
                    textStyle = MaterialTheme.typography.headlineSmall.copy(color = SS.textPrimary),
                    cursorBrush = SolidColor(SS.accent),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    decorationBox = { inner ->
                        if (title.isEmpty()) Text("Untitled", style = MaterialTheme.typography.headlineSmall, color = SS.textTertiary)
                        inner()
                    },
                )
                Spacer(Modifier.padding(top = 8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    FlowRow(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Chip(doc.type.label, doc.type.tint, icon = doc.type.icon)
                        Chip("$words words", SS.textTertiary)
                        if (onBack == null) Chip(status, if (saveState == SaveState.ERROR) SS.danger else SS.textTertiary)
                    }
                    if (onBack == null) TextButton(onClick = onDelete) { Text("Delete", color = SS.danger) }
                }
                HorizontalDivider(color = SS.border, modifier = Modifier.padding(vertical = 12.dp))
                BasicTextField(
                    value = text,
                    onValueChange = { text = it },
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = SS.textPrimary, lineHeight = 26.sp),
                    cursorBrush = SolidColor(SS.accent),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 200.dp),
                    decorationBox = { inner ->
                        if (text.isEmpty()) Text("Start writing…", style = MaterialTheme.typography.bodyLarge, color = SS.textTertiary)
                        inner()
                    },
                )
            }
        }
    }
}

@Composable
private fun NewDocumentSheet(
    folders: List<ProjectFolder>,
    initialFolder: String?,
    onDismiss: () -> Unit,
    onCreate: suspend (String, DocumentType, String?) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var type by remember { mutableStateOf(DocumentType.DOCUMENT) }
    var folderId by remember { mutableStateOf(initialFolder) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    SSSheet("New document", onDismiss) {
        SheetField("Title", title, { title = it }, placeholder = "Director's notes — day 5")
        Text("Type", style = MaterialTheme.typography.labelSmall, color = SS.textTertiary)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            DocumentType.entries.forEach { FilterPill(it.label, type == it, SS.accent) { type = it } }
        }
        if (folders.isNotEmpty()) {
            Text("Folder", style = MaterialTheme.typography.labelSmall, color = SS.textTertiary)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterPill("None", folderId == null, SS.accent) { folderId = null }
                folders.forEach { f -> FilterPill(f.name, folderId == f.id, SS.accent) { folderId = f.id } }
            }
        }
        error?.let { Text(it, color = SS.danger) }
        PrimaryButton("Create document", {
            busy = true
            scope.launch {
                try { onCreate(title, type, folderId); onDismiss() } catch (e: Exception) { error = friendly(e) } finally { busy = false }
            }
        }, loading = busy)
    }
}

@Composable
private fun NewFolderSheet(onDismiss: () -> Unit, onCreate: suspend (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    SSSheet("New folder", onDismiss) {
        SheetField("Name", name, { name = it }, placeholder = "Research")
        error?.let { Text(it, color = SS.danger) }
        PrimaryButton("Create folder", {
            busy = true
            scope.launch {
                try { onCreate(name); onDismiss() } catch (e: Exception) { error = friendly(e) } finally { busy = false }
            }
        }, enabled = name.isNotBlank(), loading = busy)
    }
}
