import { createContext, useContext, useState } from "react";
import { FsNode } from "../types/FsNode";
import { useVaultLoader } from "../hooks/useVaultLoader";

interface VaultContextType {
    root: FsNode | undefined;
    setRoot: (root: FsNode) => void;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider = ({ children, redirectIfNoVault = true }: { children: React.ReactNode; redirectIfNoVault: boolean; }) => {
    const [root, setRoot] = useState<FsNode>();
    useVaultLoader({ setRoot, redirectIfNoVault });

    return (
        <VaultContext.Provider value={{ root, setRoot }}>
            {children}
        </VaultContext.Provider>
    )
}

export const useVault = () => {
    const context = useContext(VaultContext);
    if (!context) throw new Error("useVault must be used within a VaultProvider");
    return context;
}
