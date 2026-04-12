import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function useAuthErrorListener() {
    const navigate = useNavigate();

    useEffect(() => {
        const unlisten = listen("auth:logout", () => {
            invoke("clear_user");
            invoke("clear_token", { isRefreshToken: true });
            invoke("clear_token", { isRefreshToken: false });
            navigate("/");
        });

        return () => {
            unlisten.then((f) => f());
        };
    }, [navigate]);

}
