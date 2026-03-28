import { useState } from "react";
import closeIcon from "../assets/close.svg";

function SummaryAccordion({ isLoading, text, onClose, }: { isLoading: boolean; text: string; onClose: () => void; }) {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="absolute bottom-0 left-0 right-0 z-10 max-h-[40%] flex flex-col border-t border-background-primary bg-background-primary shadow-lg">
            <div className="flex items-center justify-between px-4 py-2 bg-background-secondary cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <span className="text-white">Summary</span>
                <div className="flex items-center gap-2">
                    <span className="text-white text-sm">{isExpanded ? "▲" : "▼"}</span>
                    <button onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}><img src={closeIcon} className="w-7 h-7" /></button>
                </div>
            </div>

            {isExpanded && (
                <div className="overflow-y-auto overflow-x-hidden px-4 py-3 bg-background-primary text-white">
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <span className="animate-spin">⏳</span>
                            <span>Generating the summary..</span>
                        </div>
                    ) : (
                        <div className="prose prose-invert wrap-break-word max-w-none" dangerouslySetInnerHTML={{ __html: text }} />
                    )}
                </div>
            )}
        </div>
    );
}

export default SummaryAccordion
