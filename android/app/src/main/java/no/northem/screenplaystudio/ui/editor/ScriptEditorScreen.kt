package no.northem.screenplaystudio.ui.editor

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.CloudSync
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.FormatListNumbered
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.data.ElementType
import no.northem.screenplaystudio.data.ScriptElement
import no.northem.screenplaystudio.ui.SSTopBar
import no.northem.screenplaystudio.ui.components.SkeletonList
import no.northem.screenplaystudio.ui.theme.SS
import no.northem.screenplaystudio.ui.theme.ScriptText
import no.northem.screenplaystudio.ui.tick

/**
 * Soft keyboards don't report Backspace on an empty field, so each line
 * starts with an invisible zero-width space. Deleting it is how the editor
 * knows Backspace was pressed at the very start of a line.
 */
private const val SENTINEL = "​"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScriptEditorScreen(scriptId: String, onBack: () -> Unit) {
    val vm: EditorViewModel = viewModel(key = "editor-$scriptId") { EditorViewModel(scriptId) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    var focused by remember { mutableStateOf<String?>(null) }
    var showScenes by remember { mutableStateOf(false) }
    val view = LocalView.current

    DisposableEffect(Unit) { onDispose { vm.flush() } }

    // Keep the line being typed into visible as new ones are added.
    LaunchedEffect(vm.focusId.value) {
        val id = vm.focusId.value ?: return@LaunchedEffect
        val index = vm.indexOf(id)
        if (index >= 0 && listState.layoutInfo.visibleItemsInfo.none { it.index == index && it.offset + it.size < listState.layoutInfo.viewportEndOffset - 40 }) {
            listState.animateScrollToItem(index, -200)
        }
    }

    Scaffold(
        containerColor = SS.background,
        topBar = {
            SSTopBar(
                "Script", onBack, subtitle = vm.stats,
                actions = {
                    SaveIndicator(vm.saveState.value)
                    Box {
                        IconButton(onClick = { showScenes = true }) { Icon(Icons.Outlined.FormatListNumbered, "Jump to scene") }
                        DropdownMenu(showScenes, { showScenes = false }) {
                            val scenes = vm.sceneIndex
                            if (scenes.isEmpty()) DropdownMenuItem(text = { Text("No scene headings yet") }, onClick = { showScenes = false })
                            scenes.forEachIndexed { n, (index, heading) ->
                                DropdownMenuItem(
                                    text = { Text("${n + 1}. ${heading.uppercase()}", style = ScriptText) },
                                    onClick = { showScenes = false; scope.launch { listState.animateScrollToItem(index) } },
                                )
                            }
                        }
                    }
                },
            )
        },
        bottomBar = {
            val current = focused?.let { id -> vm.elements.firstOrNull { it.id == id } }
            if (current != null) {
                ElementBar(
                    current = current.type,
                    onPick = { view.tick(); vm.setType(current.id, it) },
                    onDelete = { vm.delete(current.id) },
                )
            }
        },
    ) { padding ->
        BoxWithConstraints(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
            // Full screenplay margins put a character cue two-thirds across a
            // phone and squeeze dialogue to three words a line. Compress them
            // to 55% on narrow screens; tablets get the real page.
            val compression = if (maxWidth < 600.dp) 0.55f else 1f
            val pageWidth = minOf(maxWidth, 760.dp)

            if (vm.loading.value && vm.elements.isEmpty()) {
                Box(Modifier.padding(SS.screenPadding)) { SkeletonList(6) }
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.widthIn(max = 760.dp).fillMaxSize(),
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 240.dp),
                ) {
                    vm.error.value?.let { item { Text(it, color = SS.warning, style = MaterialTheme.typography.bodySmall) } }
                    itemsIndexed(vm.elements, key = { _, e -> e.id }) { index, element ->
                        ElementLine(
                            element = element,
                            index = index,
                            pageWidth = pageWidth - 40.dp,
                            compression = compression,
                            vm = vm,
                            onFocus = { focused = element.id },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ElementLine(
    element: ScriptElement,
    index: Int,
    pageWidth: Dp,
    compression: Float,
    vm: EditorViewModel,
    onFocus: () -> Unit,
) {
    val type = element.type
    val requester = remember { FocusRequester() }
    var value by remember(element.id) {
        mutableStateOf(TextFieldValue(SENTINEL + element.content, TextRange(SENTINEL.length + element.content.length)))
    }
    // A remote or merge change replaced this line's text; take it.
    if (value.text.removePrefix(SENTINEL) != element.content && !value.text.contains('\n')) {
        val caret = vm.pendingCaret?.takeIf { vm.focusId.value == element.id }
        value = TextFieldValue(SENTINEL + element.content, TextRange(SENTINEL.length + (caret ?: element.content.length)))
    }

    LaunchedEffect(vm.focusId.value) {
        if (vm.focusId.value == element.id) {
            runCatching { requester.requestFocus() }
            vm.pendingCaret?.let { c ->
                value = value.copy(selection = TextRange(SENTINEL.length + c.coerceAtMost(element.content.length)))
                vm.pendingCaret = null
            }
        }
    }

    val start = pageWidth * type.leading * compression
    val end = pageWidth * type.trailing * compression
    val style = ScriptText.copy(
        color = type.color,
        fontWeight = if (type.bold) FontWeight.Bold else FontWeight.Normal,
        fontStyle = if (type.italic) FontStyle.Italic else FontStyle.Normal,
        textAlign = when (type.align) {
            ElementType.Align.START -> TextAlign.Start
            ElementType.Align.CENTER -> TextAlign.Center
            ElementType.Align.END -> TextAlign.End
        },
    )

    fun onChange(new: TextFieldValue) {
        val text = new.text
        if (!text.startsWith(SENTINEL)) {
            // The sentinel went: Backspace at position 0.
            if (index > 0) vm.mergeUp(element.id) else value = new.copy(text = SENTINEL + text, selection = TextRange(SENTINEL.length))
            return
        }
        val body = text.removePrefix(SENTINEL)
        val newline = body.indexOf('\n')
        if (newline >= 0) {
            vm.split(element.id, body.substring(0, newline), body.substring(newline + 1).replace("\n", ""))
            value = TextFieldValue(SENTINEL + body.substring(0, newline))
            return
        }
        // Never let the caret slip in front of the sentinel.
        val sel = TextRange(new.selection.start.coerceAtLeast(1), new.selection.end.coerceAtLeast(1))
        value = new.copy(selection = sel)
        vm.edit(element.id, body)
    }

    Box(
        Modifier
            .fillMaxWidth()
            .padding(top = if (index == 0) 0.dp else type.spacingAbove.dp, start = start, end = end)
            .then(
                if (type == ElementType.NOTE) Modifier.border(width = 0.dp, color = Color.Transparent)
                    .background(Color.White.copy(alpha = 0.03f), RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 4.dp)
                else Modifier
            ),
    ) {
        if (element.content.isEmpty()) {
            Text(
                type.placeholder, style = style.copy(color = SS.S600, fontWeight = FontWeight.Normal),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        BasicTextField(
            value = value,
            onValueChange = ::onChange,
            textStyle = style,
            cursorBrush = SolidColor(SS.accent),
            visualTransformation = if (type.uppercase) UppercaseTransformation else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(
                capitalization = if (type.uppercase) KeyboardCapitalization.Characters else KeyboardCapitalization.Sentences,
                autoCorrectEnabled = !type.uppercase,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(requester)
                .onFocusChanged { if (it.isFocused) { onFocus(); vm.focusId.value = element.id } }
                .onPreviewKeyEvent { e ->
                    // Hardware keyboards and Chromebooks: Tab cycles the element
                    // type, as it does on the web.
                    if (e.type == KeyEventType.KeyDown && e.key == Key.Tab) {
                        val cycle = ElementType.STANDARD
                        val i = cycle.indexOf(type).coerceAtLeast(0)
                        val next = if (e.isShiftPressed) cycle[(i + cycle.size - 1) % cycle.size] else cycle[(i + 1) % cycle.size]
                        vm.setType(element.id, next)
                        true
                    } else false
                },
        )
    }
}

private object UppercaseTransformation : VisualTransformation {
    override fun filter(text: AnnotatedString) = TransformedText(AnnotatedString(text.text.uppercase()), OffsetMapping.Identity)
}

/** The element switcher above the keyboard — there is no Tab key on a phone. */
@Composable
private fun ElementBar(current: ElementType, onPick: (ElementType) -> Unit, onDelete: () -> Unit) {
    Surface(color = SS.S900, modifier = Modifier.imePadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(
                Modifier.weight(1f).horizontalScroll(rememberScrollState()).padding(start = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                ElementType.STANDARD.forEach { t ->
                    val selected = t == current
                    Surface(
                        onClick = { onPick(t) },
                        shape = CircleShape,
                        color = if (selected) SS.accent else SS.elevated,
                    ) {
                        Text(
                            t.label, style = MaterialTheme.typography.labelLarge,
                            color = if (selected) Color.White else SS.textSecondary,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        )
                    }
                }
            }
            IconButton(onClick = onDelete) { Icon(Icons.Outlined.DeleteOutline, "Delete this line", tint = SS.textTertiary) }
        }
    }
}

@Composable
private fun SaveIndicator(state: SaveState) {
    val (icon, tint, label) = when (state) {
        SaveState.SAVED -> Triple(Icons.Outlined.CloudDone, SS.textTertiary, "Saved")
        SaveState.SAVING -> Triple(Icons.Outlined.CloudSync, SS.Brand300, "Saving")
        SaveState.OFFLINE -> Triple(Icons.Outlined.CloudOff, SS.warning, "Offline — will retry")
        SaveState.ERROR -> Triple(Icons.Outlined.ErrorOutline, SS.danger, "Not saved")
    }
    Icon(icon, label, Modifier.padding(horizontal = 8.dp).size(20.dp), tint = tint)
}
