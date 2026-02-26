import { createContext, useState, useEffect } from 'react';

export const UserContext = createContext();

export default function UserProvider({ children }) {

    const getUserFromLocalStorage = () => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : { userId: null, username: '', email: '', token: null };
    }

    const [user, setUser] = useState(getUserFromLocalStorage);

    useEffect(() => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        }
        else {
            localStorage.removeItem('user');
        }
    }, [user]);

    return (
        <UserContext.Provider value={{ user, setUser }}>
            {children}
        </UserContext.Provider>
    );
}
