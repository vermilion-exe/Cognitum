import { createContext, useContext, useState } from "react";

interface ActiveFileContextType {
    activeFileId: string | undefined;
    setActiveFileId: (id: string | undefined) => void;
}

const ActiveFileContext = createContext<ActiveFileContextType | undefined>(undefined);

export const ActiveFileProvider = ({ children }: { children: React.ReactNode }) => {
    const [activeFileId, setActiveFileId] = useState<string | undefined>();

    return (
        <ActiveFileContext.Provider value={{ activeFileId, setActiveFileId }}>
            {children}
        </ActiveFileContext.Provider>
    );
};

export const useActiveFile = () => {
    const context = useContext(ActiveFileContext);
    if (!context) throw new Error("useActiveFile must be used within an ActiveFileProvider");
    return context;
};
