import { useNavigate } from "react-router-dom";
import { MainHeader } from "../components";

function Home() {
    const navigate = useNavigate();

    function handleLogin() {
        navigate('/login');
    }

    function handleRegister() {
        navigate('/register');
    }

    function handleGuest() {
        navigate('/mainPage');
    }

    return (
        <main className="min-h-screen flex flex-col items-center gap-[30vw] pt-[10vh]">
            <MainHeader />
            <div className="flex flex-col items-center gap-2">
                <div className="flex gap-7">
                    <button className="rounded-md border border-button-primary bg-button-primary text-white text-2xl px-12" onClick={handleLogin}>Login</button>
                    <button className="rounded-md border border-button-secondary bg-button-secondary text-white text-2xl px-8" onClick={handleRegister}>Register</button>
                </div>
                <button className="text-1xl text-white" onClick={handleGuest}>Continue as a guest...</button>
            </div>
        </main >
    );
}

export default Home
