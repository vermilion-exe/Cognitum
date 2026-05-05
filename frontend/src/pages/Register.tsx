import { useEffect, useState } from 'react';
import { MainHeader } from '../components';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useUser } from '../contexts/UserContext';
import { RequestRegister } from '../types/RequestRegister';
import { ResponseAuth } from '../types/ResponseAuth';
import { useToast } from '../hooks/useToast';
import { isApiError } from '../types/ApiError';

const EMAIL_VALIDATION_MESSAGE = "Enter a valid email address";
const USERNAME_VALIDATION_MESSAGE = "Username must be 3-30 characters and use only letters, numbers, and underscores";
const PASSWORD_VALIDATION_MESSAGE = "Password must be at least 8 characters and include uppercase, lowercase, and a number";

function getEmailValidationError(email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return EMAIL_VALIDATION_MESSAGE;
    }

    return null;
}

function getUsernameValidationError(username: string) {
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username.trim())) {
        return USERNAME_VALIDATION_MESSAGE;
    }

    return null;
}

function getPasswordValidationError(password: string) {
    if (password.length < 8) {
        return PASSWORD_VALIDATION_MESSAGE;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return PASSWORD_VALIDATION_MESSAGE;
    }

    return null;
}

function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { setUser } = useUser();
    const navigate = useNavigate();
    const toast = useToast();
    const isTestMode = import.meta.env.MODE === 'test';

    useEffect(() => {
        console.log(import.meta.env.MODE);
        console.log(isTestMode);
    }, []);

    function handleReturn() {
        navigate('/');
    }

    async function handleRegister() {
        const emailValidationError = getEmailValidationError(email);
        const usernameValidationError = getUsernameValidationError(username);
        const passwordValidationError = getPasswordValidationError(password);

        if (emailValidationError) {
            toast.warning(emailValidationError);
            return;
        }

        if (usernameValidationError) {
            toast.warning(usernameValidationError);
            return;
        }

        if (passwordValidationError) {
            toast.warning(passwordValidationError);
            return;
        }

        const payload: RequestRegister = { username: username.trim(), email: email.trim(), password };
        await invoke<ResponseAuth>("request_register", { request: payload })
            .then(async (result) => {
                setUser({ userId: result.user_id, email: result.email, username: result.username, is_active: result.is_active });
                await invoke("save_token", { token: result.access_token, isRefreshToken: false });
                await invoke("save_token", { token: result.refresh_token, isRefreshToken: true });
                toast.success("Register successful");

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
            .catch((e: unknown) => {
                if (isApiError(e)) {
                    if (e.status === 409) {
                        toast.warning("An account with this email already exists");
                        return;
                    }

                    if (e.status === 400) {
                        toast.error(e.message || "Please check your registration details");
                        return;
                    }

                    toast.error(e.message || "Register failed");
                    return;
                }

                toast.error("Register failed due to an error");
                console.error("Register failed: ", e);
            });
    }

    return (
        <div className='min-h-screen flex flex-col items-center gap-[30vw] pt-[10vh]'>
            <div className='absolute left-5 top-10 text-white text-2xl' onClick={handleReturn}>{'< Back'}</div>
            <MainHeader />
            <div className='flex flex-col gap-4 w-full max-w-md'>
                <label htmlFor='Username' className='relative w-full'>
                    <input type='text' id='Username' placeholder='' value={username} autoComplete='off' onChange={(e) => setUsername(e.target.value)} className='peer mt-0.5 w-full rounded shadow-sm sm:text-sm border-gray-600 bg-gray-900 text-white' />

                    <span className='absolute inset-y-2.5 start-3 -translate-y-4.5 px-0.5 text-sm font-medium transition-transform peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-4.5 text-white'>
                        Username
                    </span>
                </label>
                <label htmlFor='Email' className='relative w-full'>
                    <input type='email' id='Email' placeholder='' value={email} autoComplete='off' onChange={(e) => setEmail(e.target.value)} className='peer mt-0.5 w-full rounded shadow-sm sm:text-sm border-gray-600 bg-gray-900 text-white' />

                    <span className='absolute inset-y-2.5 start-3 -translate-y-4.5 px-0.5 text-sm font-medium transition-transform peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-4.5 text-white'>
                        Email
                    </span>
                </label>
                <label htmlFor='Password' className='relative'>
                    <input type='password' id='Password' placeholder='' value={password} autoComplete='new-password' onChange={(e) => setPassword(e.target.value)} className='peer mt-0.5 w-full rounded shadow-sm sm:text-sm border-gray-600 bg-gray-900 text-white' />

                    <span className='absolute inset-y-2.5 start-3 -translate-y-4.5 px-0.5 text-sm font-medium transition-transform peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-4.5 text-white'>
                        Password
                    </span>
                </label>
                <button className='rounded-md border border-button-primary bg-button-primary text-white text-2xl px-12 hover:bg-button-primary/50' name='Register' onClick={handleRegister}>Register</button>
            </div>
        </div>
    );
}

export default Register
