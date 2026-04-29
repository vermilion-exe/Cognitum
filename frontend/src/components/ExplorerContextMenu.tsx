import { useEffect, useRef } from "react";
import { ContextMenuOption } from "../types/ContextMenuOption";
import { createPortal } from "react-dom";

export function ExplorerContextMenu({
    x,
    y,
    options,
    onClose
}: {
    x: number;
    y: number;
    options: ContextMenuOption[];
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };

        window.addEventListener("mousedown", handleClick);
        return () => window.removeEventListener("mousedown", handleClick);
    }, [onClose]);

    return createPortal(
        <div
            ref={ref}
            className="absolute z-50 min-w-40 bg-background-primary border border-white/10 rounded-md shadow-lg py-1 text-sm text-white"
            style={{ left: x, top: y }}>
            {options.map((opt) => (
                <button
                    aria-label={opt.label}
                    key={opt.label}
                    className={`w-full text-left px-4 py-2 hover:bg-white/10 transition-colors ${opt.danger ? "text-red-400" : ""}`}
                    onMouseUp={(e) => {
                        e.stopPropagation();
                        opt.onClick();
                        onClose();
                    }}
                    onPointerUp={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}>
                    {opt.label}
                </button>
            ))}
        </div>,
        document.body
    );
}
