import {
    Plugin,
    PluginKey,
} from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";

const key = new PluginKey("selection-tooltip");

export function selectionTooltipPlugin(
    onExplain: (text: string, from: number, to: number) => void
) {
    let tooltip: HTMLElement | null = null;

    return new Plugin({
        key,
        view(editorView: EditorView) {
            tooltip = document.createElement("div");
            tooltip.className =
                "absolute z-50 hidden bg-background-secondary " +
                "border border-button-primary rounded-md shadow-lg px-2 py-1";
            editorView.dom.parentElement?.appendChild(tooltip);

            return {
                update(view: EditorView) {
                    const { from, to, empty } = view.state.selection;

                    if (empty) {
                        tooltip!.style.display = "none";
                        return;
                    }

                    const selectedText = view.state.doc.textBetween(from, to);

                    const start = view.coordsAtPos(from);
                    const end = view.coordsAtPos(to);
                    const parent =
                        view.dom.parentElement!.getBoundingClientRect();

                    const left =
                        (start.left + end.left) / 2 - parent.left;
                    const top = start.top - parent.top - 40;

                    tooltip!.style.display = "flex";
                    tooltip!.style.left = `${left}px`;
                    tooltip!.style.top = `${top}px`;
                    tooltip!.style.transform = "translateX(-50%)";

                    tooltip!.innerHTML = "";
                    const btn = document.createElement("button");
                    btn.textContent = "✨ Explain";
                    btn.className =
                        "text-white text-sm px-2 py-1 hover:opacity-75";
                    btn.onmousedown = (e) => {
                        e.preventDefault();
                        onExplain(selectedText, from, to);
                    };
                    tooltip!.appendChild(btn);
                },
                destroy() {
                    tooltip?.remove();
                },
            };
        },
    });
}
