import { ToastOptions } from "react-toastify";
import { useToastContext } from "../contexts/ToastContext";

export const useToast = () => {
    const { showSuccess, showError, showWarning, showInfo } = useToastContext();

    const defaultOptions: ToastOptions = {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
    };

    return {
        success: (message: string, options?: ToastOptions) =>
            showSuccess(message, { ...defaultOptions, ...options }),
        error: (message: string, options?: ToastOptions) =>
            showError(message, { ...defaultOptions, autoClose: 5000, ...options }),
        warning: (message: string, options?: ToastOptions) =>
            showWarning(message, { ...defaultOptions, ...options }),
        info: (message: string, options?: ToastOptions) =>
            showInfo(message, { ...defaultOptions, ...options }),
    };
};
