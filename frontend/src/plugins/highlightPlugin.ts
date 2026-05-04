import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node } from "@milkdown/kit/prose/model";
import { ResponseHighlight } from "../types/ResponseHighlight";

interface HighlightPluginOptions {
    getHighlights: () => ResponseHighlight[];
    onHighlightsChange: (highlights: ResponseHighlight[]) => void;
    onHighlightClick: (id: string) => void;
}

interface PluginState {
    highlights: ResponseHighlight[];
    loadingAnchor: number | null;
}

export const highlightPluginKey = new PluginKey<PluginState>("highlight-explanation");

export const setHighlightsMeta = "highlight/setHighlights";
export const setLoadingMeta = "highlight/setLoading";
export const setFullReplaceMeta = "highlight/fullReplace";

function findText(doc: Node, text: string): { from: number; to: number } | null {
    // Find the first exact text match in the document
    let found: { from: number; to: number } | null = null;
    doc.descendants((node, pos) => {
        if (found || !node.isText) return !found;
        const idx = (node.text ?? "").indexOf(text);
        if (idx !== -1) found = { from: pos + idx, to: pos + idx + text.length };
    });
    return found;
}

function validateAndRestore(doc: Node, highlights: ResponseHighlight[]): ResponseHighlight[] {
    // Keep valid ranges and restore moved ones by matching their selected text
    return highlights.flatMap((h) => {
        // Check stored positions first
        if (h.to <= doc.content.size && doc.textBetween(h.from, h.to) === h.selected_text)
            return [h];
        // Fall back to text search
        const pos = findText(doc, h.selected_text);
        return pos ? [{ ...h, ...pos }] : [];
    });
}

export function createHighlightPlugin(options: HighlightPluginOptions): Plugin<PluginState> {
    const { getHighlights, onHighlightsChange, onHighlightClick } = options;

    // Popover element shared across the plugin view
    let popover: HTMLDivElement | null = null;

    return new Plugin({
        key: highlightPluginKey,

        // Store the validated highlights in plugin state
        state: {
            init: (_, state): PluginState => ({
                highlights: validateAndRestore(state.doc, getHighlights()),
                loadingAnchor: null,
            }),
            apply: (tr, pluginState): PluginState => {
                let { highlights, loadingAnchor }: PluginState = pluginState;

                // React can push a fresh highlight list through transaction meta
                const nextHighlights = tr.getMeta(setHighlightsMeta);
                if (nextHighlights !== undefined) {
                    highlights = validateAndRestore(tr.doc, nextHighlights);
                }

                // Track where to render the inline loading spinner
                const loadingChanged = tr.getMeta(setLoadingMeta);
                if (loadingChanged === true) {
                    loadingAnchor = tr.selection.to;
                }
                else if (loadingChanged === false) {
                    loadingAnchor = null;
                }

                // Re-check highlights after a complete document replacement
                if (tr.getMeta(setFullReplaceMeta)) {
                    highlights = validateAndRestore(tr.doc, getHighlights());
                }
                if (tr.docChanged && loadingAnchor !== null) {
                    loadingAnchor = tr.mapping.map(loadingAnchor, 1);
                }

                if (tr.docChanged && nextHighlights === undefined) {
                    // Map positions through the transaction, drop invalidated ranges
                    const mapped = highlights.flatMap((h) => {
                        const from = tr.mapping.map(h.from, -1);
                        const to = tr.mapping.map(h.to, 1);

                        if (from >= to || to > tr.doc.content.size || tr.doc.textBetween(from, to) !== h.selected_text) {
                            const pos = findText(tr.doc, h.selected_text);
                            return pos ? [{ ...h, ...pos }] : [];
                        }

                        return [{ ...h, from, to }];
                    });

                    // Notify React if any highlights were dropped
                    if (mapped.length < highlights.length)
                        queueMicrotask(() => onHighlightsChange(mapped));

                    highlights = mapped;
                }

                return { highlights, loadingAnchor };
            },
        },

        props: {
            decorations: (state) => {
                const { highlights, loadingAnchor } = highlightPluginKey.getState(state) ?? { highlights: [], loadingAnchor: null };
                // Draw each valid highlight as an inline decoration
                const decorations = highlights
                    .filter((h: ResponseHighlight) => h.from < h.to && h.to <= state.doc.content.size)
                    .map((h: ResponseHighlight) =>
                        Decoration.inline(h.from, h.to, {
                            class: "highlight-explanation",
                            "data-highlight-id": h.id,
                        })
                    );

                // Add a widget decoration for pending explanation generation
                if (loadingAnchor !== null) {
                    const anchor = Math.min(
                        loadingAnchor,
                        state.doc.content.size
                    );
                    decorations.push(
                        Decoration.widget(
                            anchor,
                            () => {
                                const span = document.createElement("span");
                                span.className = "relative animate-spin inline-block -top-1 ml-1";
                                span.textContent = "⏳";
                                return span;
                            },
                            { side: 1, key: "loading-spinner" }
                        )
                    );
                }

                return DecorationSet.create(state.doc, decorations);
            },

            handleDOMEvents: {
                mouseover: (view, e) => {
                    // Show a small explanation preview above the hovered highlight
                    const id = (e.target as HTMLElement)
                        .closest<HTMLElement>("[data-highlight-id]")
                        ?.dataset.highlightId;
                    if (!id || !popover) return false;

                    const { highlights } = highlightPluginKey.getState(view.state) as PluginState;
                    const h = highlights.find(
                        (h) => h.id === id
                    );
                    if (!h) return false;

                    const { left: pLeft, top: pTop } =
                        view.dom.parentElement!.getBoundingClientRect();
                    const coords = view.coordsAtPos(h.from);

                    popover.textContent =
                        h.explanation.length > 100
                            ? h.explanation.slice(0, 100) + "…"
                            : h.explanation;
                    Object.assign(popover.style, {
                        display: "block",
                        left: `${coords.left - pLeft}px`,
                        top: `${coords.top - pTop - 8}px`,
                        transform: "translateY(-100%)",
                    });
                    return false;
                },
                mouseout: (_view, e) => {
                    // Hide the preview when the pointer leaves a highlight
                    if (
                        popover &&
                        (e.target as HTMLElement).closest("[data-highlight-id]")
                    )
                        popover.style.display = "none";
                    return false;
                },
                click: (_, e) => {
                    // Let React open the full explanation for the clicked highlight
                    const id = (e.target as HTMLElement)
                        .closest<HTMLElement>("[data-highlight-id]")
                        ?.dataset.highlightId;
                    if (!id) return false;
                    onHighlightClick(id);
                    return true;
                },
            },
        },

        view: (editorView: EditorView) => {
            // Create the hover popover once for this editor view
            popover = document.createElement("div");
            popover.className =
                "absolute z-50 hidden max-w-xs rounded-md border border-button-primary " +
                "bg-background-secondary px-3 py-2 text-sm text-white shadow-lg pointer-events-none";
            editorView.dom.parentElement?.appendChild(popover);
            return { destroy: () => popover?.remove() };
        },
    });
}
