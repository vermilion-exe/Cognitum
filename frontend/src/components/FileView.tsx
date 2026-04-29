import { useEffect, useState } from "react";
import { useActiveFile } from "../contexts/ActiveFileContext";
import { invoke } from "@tauri-apps/api/core";
import { useFileTree } from "../contexts/FileTreeContext";
import { isImage } from "../utils/fsUtils";

function FileView() {
    const { activeFileId } = useActiveFile();
    const { root } = useFileTree();
    const [file, setFile] = useState<{ content: string, isImage: boolean } | null>(null);

    useEffect(() => {
        async function readContent() {
            if (isImage(root, activeFileId!)) {
                const imageBytes = await invoke<number[]>("read_image", { path: activeFileId });

                const byteArray = new Uint8Array(imageBytes);
                const extension = activeFileId?.split('.').pop()?.toLowerCase();
                const blob = new Blob([byteArray], { type: "image/" + extension });

                const url = URL.createObjectURL(blob);
                setFile({ content: url, isImage: true });
            }
            else {
                const content = await invoke<string>("read_file", { path: activeFileId });
                setFile({ content: content, isImage: false });
            }
        }

        readContent();
    }, [activeFileId]);

    return (
        <div className="flex flex-col justify-center h-full items-center gap-10">
            <div className="flex items-start justify-between w-100">
                {file?.isImage ? (
                    <img src={file.content} />
                ) : file?.content}
            </div>
        </div>
    );
}

export default FileView
