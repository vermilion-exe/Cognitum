import { useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "katex/dist/katex.min.css";

export default function TextEditor() {
    const hostRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!hostRef.current) return;

        const crepe = new Crepe({
            root: hostRef.current,
            defaultValue: `# Hello

Inline: $E = mc^2$

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$
`,
            // In some Crepe versions, features can be toggled. If your version supports it,
            // enable latex/math here (naming may vary).
            // features: { latex: true },
        });

        crepe.create();

        return () => {
            crepe.destroy();
        };
    }, []);

    return <div className="h-full w-full min-h-0 nodrag overflow-x-hidden overflow-y-auto" ref={hostRef} />;
}
