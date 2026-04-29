import { useState } from "react";
import { useFileTree } from "../contexts/FileTreeContext";

function FileCreationModal({ setIsModalActive }: { setIsModalActive: (isActive: boolean) => void; }) {
    const [fileName, setFileName] = useState("");
    const { root, createNode } = useFileTree();

    const handleFileCreation = () => {
        if (!fileName || fileName === "") return;
        createNode(root?.id!, fileName, false);
        setIsModalActive(false);
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setIsModalActive(false)}
        >
            <div
                className="relative mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-background-secondary shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-background-primary p-6 pb-4">
                    <div>
                        <h2 className="text-3xl font-semibold text-white">File Creation</h2>
                    </div>
                    <button
                        className="ml-4 text-gray-400 transition hover:text-white"
                        onClick={() => setIsModalActive(false)}
                    >
                        ✕
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="prose prose-invert wrap-break-word max-w-none">
                        <h1 className="text-xl">Please enter the file name:</h1>
                        <label className='relative'>
                            <input type='text' aria-label='FileName' placeholder='' value={fileName} onChange={(e) => setFileName(e.target.value)}
                                className='peer w-full rounded shadow-sm sm:text-sm border-gray-600 bg-gray-900 text-white mt-4 mb-3' />

                            <span className='absolute inset-y-0 start-3 -translate-y-4.5 px-0.5 text-sm font-medium transition-transform peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-4.5 text-white'>
                                File Name
                            </span>
                        </label>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 border-t border-background-primary p-6 pt-4">
                    <button
                        className="rounded-lg bg-button-secondary px-4 py-2 text-sm text-white transition hover:bg-button-secondary/50"
                        onClick={() => setIsModalActive(false)}
                    >
                        Close
                    </button>
                    <button aria-label="SubmitCreateFile"
                        className="rounded-lg bg-button-primary px-4 py-2 text-sm text-white transition hover:bg-button-primary/50"
                        onClick={() => handleFileCreation()}
                    >
                        Submit
                    </button>
                </div>
            </div>
        </div>
    );
}

export default FileCreationModal
