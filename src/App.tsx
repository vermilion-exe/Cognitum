import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {

    return (
        <main className="min-h-screen flex flex-col items-center gap-[30vw] pt-[10vh]">
            <div className="text-9xl font-semibold text-white text-center">
                Cognitum
            </div>
            <div className="flex flex-col items-center gap-2">
                <div className="flex gap-7">
                    <button className="rounded-md border border-button-primary bg-button-primary text-white text-2xl px-12">Login</button>
                    <button className="rounded-md border border-button-secondary bg-button-secondary text-white text-2xl px-8">Register</button>
                </div>
                <button className="text-1xl text-white">Continue as a guest...</button>
            </div>
        </main >
    );
}

export default App;
