import { createContext, ReactNode, useContext } from 'react';
import { toast, ToastOptions } from 'react-toastify';

interface ToastContextType {
    showSuccess: (message: string, options?: ToastOptions) => void;
    showError: (message: string, options?: ToastOptions) => void;
    showWarning: (message: string, options?: ToastOptions) => void;
    showInfo: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const showSuccess = (message: string, options?: ToastOptions) => {
        toast.success(message, options);
    }

    const showError = (message: string, options?: ToastOptions) => {
        toast.error(message, options);
    }

    const showWarning = (message: string, options?: ToastOptions) => {
        toast.warning(message, options);
    }

    const showInfo = (message: string, options?: ToastOptions) => {
        toast.info(message, options);
    }

    return (
        <ToastContext.Provider value={{ showSuccess, showError, showWarning, showInfo }}>
            {children}
        </ToastContext.Provider>
    )
}

export const useToastContext = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToastContext must be used within a ToastProvider");
    }
    return context;
}
