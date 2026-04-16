import { useState } from 'react';
import { MainHeader } from '../components';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { RequestAuth } from '../types/RequestAuth';
import { ResponseAuth } from '../types/ResponseAuth';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../hooks/useToast';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { setUser } = useUser();
    const navigate = useNavigate();
    const toast = useToast();

    function handleReturn() {
        navigate('/');
    }

    async function handleLogin() {
        const payload: RequestAuth = { email, password };
        await invoke<ResponseAuth>("request_auth", { request: payload })
            .then(async (result) => {
                setUser({ userId: result.user_id, email: result.email, username: result.username });
                await invoke("save_token", { token: result.access_token, isRefreshToken: false });
                await invoke("save_token", { token: result.refresh_token, isRefreshToken: true });
                toast.success("Login successful");

                console.log(result.is_active);
                if (!result.is_active) {
                    navigate('/emailConfirmation');
                    return;
                }

                const cfg = await invoke<{ vaultPath?: string }>("load_config");

                if (!cfg.vaultPath) {
                    navigate('/choosePath');
                }
                else {
                    navigate('/mainPage');
                }
            })
            .catch((e) => {
                toast.error("Login failed due to an error");
                console.error("Login failed: ", e);
            });
    }

    return (
        <div className='min-h-screen flex flex-col items-center gap-[30vw] pt-[10vh]'>
            <div className='absolute left-5 top-10 text-white text-2xl' onClick={handleReturn}>{'< Back'}</div>
            <MainHeader />
            <div className='flex flex-col gap-4 w-full max-w-md'>
                <label htmlFor='Email' className='relative w-full'>
                    <input type='email' id='Email' placeholder='' value={email} onChange={(e) => setEmail(e.target.value)} className='peer mt-0.5 w-full rounded shadow-sm sm:text-sm border-gray-600 bg-gray-900 text-white' />

                    <span className='absolute inset-y-2.5 start-3 -translate-y-4.5 px-0.5 text-sm font-medium transition-transform peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-4.5 text-white'>
                        Email
                    </span>
                </label>
                <label htmlFor='Password' className='relative'>
                    <input type='password' id='Password' placeholder='' value={password} onChange={(e) => setPassword(e.target.value)} className='peer mt-0.5 w-full rounded shadow-sm sm:text-sm border-gray-600 bg-gray-900 text-white' />

                    <span className='absolute inset-y-2.5 start-3 -translate-y-4.5 px-0.5 text-sm font-medium transition-transform peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-4.5 text-white'>
                        Password
                    </span>
                </label>
                <button className='rounded-md border border-button-primary bg-button-primary text-white text-2xl px-12' onClick={handleLogin}>Login</button>
            </div>
        </div>
    );
}

export default Login
