import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
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
                "fixed z-[9999] hidden items-center gap-1 " +
                "rounded-r-md shadow-button px-2 py-2";

            // Append to body to avoid stacking context / overlap issues
            document.body.appendChild(tooltip);

            const btn = document.createElement("button");
            btn.innerHTML = "✨ Explain";
            btn.className =
                "flex items-center gap-1 text-white text-sm cursor-pointer " +
                "px-2 py-1 whitespace-nowrap";

            tooltip.appendChild(btn);

            return {
                update(view: EditorView) {
                    const { from, to, empty } = view.state.selection;

                    if (empty) {
                        tooltip!.style.display = "none";
                        return;
                    }

                    const selectedText = view.state.doc.textBetween(
                        from,
                        to
                    );

                    // Use the start of selection for positioning
                    const start = view.coordsAtPos(from);
                    const end = view.coordsAtPos(to);

                    const midX = (start.left + end.left) / 2;
                    // Position above the selection line
                    const topY = start.top + window.scrollY - 44;

                    tooltip!.style.display = "flex";
                    tooltip!.style.position = "fixed";
                    tooltip!.style.left = `${midX + 194.5}px`;
                    tooltip!.style.top = `${start.top - 54.5}px`;
                    tooltip!.style.transform = "translateX(-50%)";

                    btn.onmousedown = (e) => {
                        e.preventDefault();
                        onExplain(selectedText, from, to);
                    };
                },
                destroy() {
                    tooltip?.remove();
                },
            };
        },
    });
}
