import { createContext, useState, useEffect, useContext } from 'react';
import { User } from '../types/User';
import { invoke } from '@tauri-apps/api/core';

interface UserContextType {
    user: User | undefined;
    setUser: (user: User | undefined) => void;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | undefined>(undefined);

    useEffect(() => {
        getUserFromStorage();
    }, []);


    const getUserFromStorage = async () => {
        await invoke<User>("load_user").then(setUser).catch(() => setUser(undefined));
    }

    const handleSetUser = async (user: User | undefined) => {
        if (user) {
            await invoke("save_user", { user });
        } else {
            await invoke("clear_user");
        }

        setUser(user);
    }

    return (
        <UserContext.Provider value={{ user, setUser: handleSetUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) throw new Error("useUser must be used within an UserProvider");
    return context;
}
