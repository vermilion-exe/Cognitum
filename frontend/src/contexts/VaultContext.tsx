import { createContext, RefObject, useContext, useRef, useState } from "react";
import { FsNode } from "../types/FsNode";
import { useVaultLoader } from "../hooks/useVaultLoader";

interface VaultContextType {
    root: FsNode | undefined;
    setRoot: (root: FsNode) => void;
    ignoredFileWritesRef: RefObject<Map<string, number>>;
    markAppFileWrite: (path: string) => void;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider = ({ children, redirectIfNoVault = true }: { children: React.ReactNode; redirectIfNoVault: boolean; }) => {
    const [root, setRoot] = useState<FsNode>();
    useVaultLoader({ setRoot, redirectIfNoVault });

    const ignoredFileWritesRef = useRef<Map<string, number>>(new Map());

    const markAppFileWrite = (path: string) => {
        ignoredFileWritesRef.current.set(path, Date.now() + 2000);
    };

    return (
        <VaultContext.Provider value={{ root, setRoot, ignoredFileWritesRef, markAppFileWrite }}>
            {children}
        </VaultContext.Provider>
    )
}

export const useVault = () => {
    const context = useContext(VaultContext);
    if (!context) throw new Error("useVault must be used within a VaultProvider");
    return context;
}
