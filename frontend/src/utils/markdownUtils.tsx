import { marked } from "marked";
import katex from "katex";

export function renderMarkdownWithLatex(text: string): string {
    let rendered = text.replace(
        /\$\$([\s\S]*?)\$\$/g,
        (_, tex) => katex.renderToString(tex.trim(), { displayMode: true }),
    );

    rendered = rendered.replace(
        /\\\(([\s\S]*?)\\\)/g,
        (match, tex) => {
            try {
                return katex.renderToString(tex.trim(), { displayMode: true });
            }
            catch {
                return match;
            }
        });

    return marked.parse(rendered) as string;
}
