import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useToast } from "../hooks/useToast";
import { resolveResource } from '@tauri-apps/api/path';

function Manual({ setIsManualHidden }: { setIsManualHidden: (isOpen: boolean) => void }) {
    const [manual, setManual] = useState("");
    const toast = useToast();

    async function resolveMarkdownImages(markdown: string): Promise<string> {
        const imageRegex = /!\[([^\]]*)\]\(\.\/([^)]+)\)/g;
        const matches = [...markdown.matchAll(imageRegex)];

        let resolved = markdown;
        for (const match of matches) {
            const [full, alt, filename] = match;
            const resourcePath = await resolveResource(`resources/${filename}`);
            const url = convertFileSrc(resourcePath);
            resolved = resolved.replace(full, `![${alt}](${url})`);
        }

        return resolved;
    }

    useEffect(() => {
        async function getManual() {
            try {
                let man = await invoke<string>("get_manual");
                man = man.replace(/\r\n/g, "\n")           // normalize line endings
                    .replace(/([^\n])\n([^\n])/g, "$1  \n$2")  // soft breaks
                    .replace(/\(#([^)]+)\)/g, (_, anchor) => {
                        const slug = anchor.toLowerCase().replace(/\s+/g, "-");
                        return `(#${slug})`;
                    });
                man = await resolveMarkdownImages(man);
                setManual(man);
            }
            catch (e) {
                toast.error("Could not find manual");
                setIsManualHidden(true);
            }
        }

        getManual();
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setIsManualHidden(true)}
        >
            <div
                className="relative mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-background-primary shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-background-primary p-6 pb-4">
                    <div>
                        <h2 className="text-2xl font-semibold text-white">Manual</h2>
                    </div>
                    <button
                        className="ml-4 text-gray-400 transition hover:text-white"
                        onClick={() => setIsManualHidden(true)}
                    >
                        ✕
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="markdown-content max-w-none">
                        {manual ? (
                            <Markdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex, rehypeRaw, rehypeSlug, rehypeAutolinkHeadings]}>
                                {manual}
                            </Markdown>
                        ) : <p>Loading...</p>}
                    </div>
                </div>
            </div>
        </div >
    );
}

export default Manual
