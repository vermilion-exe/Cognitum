import { invoke } from '@tauri-apps/api/core';
import mailIcon from '../assets/mail.svg';
import { useUser } from '../contexts/UserContext';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { User } from '../types/User';

function EmailConfirmation() {
    const [code, setCode] = useState<number | undefined>();
    const [resendTime, setResendTime] = useState(60);
    const [timerKey, setTimerKey] = useState(0);
    const location = useLocation();
    const { isPasswordChange, newPassword, confirmPassword } = location.state || {};
    const navigate = useNavigate();
    const { user, setUser } = useUser();
    const toast = useToast();

    useEffect(() => {
        let timer = setInterval(() => {
            setResendTime((time) => {
                if (time <= 0) {
                    clearInterval(timer);
                    return 0;
                }
                else {
                    return time - 1;
                }
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timerKey]);

    function handleReturn() {
        if (isPasswordChange) {
            navigate('/mainPage');
            return;
        }
        navigate('/');
    }

    const handleResendConfirmation = async () => {
        if (resendTime !== 0) return;

        await invoke("email_send_code", { email: user?.email, isChangePassword: false });
        setResendTime(60);
        setTimerKey((k) => k + 1);
    }

    const handleConfirmation = async () => {
        if (!user || !code) return;
        try {
            console.log(isPasswordChange);
            if (isPasswordChange) {
                await invoke("change_password", { request: { email: user.email, email_confirm_code: code, new_password: newPassword, confirm_password: confirmPassword } });
                navigate('/mainPage');
                toast.success("Password changed successfully");
                return;
            }
            await invoke("confirm_code", { request: { email: user.email, code: code } });
            const newUser: User = {...user, is_active: true};
            setUser(newUser);
            navigate('/mainPage');
            toast.success("Email confirmed successfully");
        }
        catch (e) {
            toast.error("The code you entered is likely incorrect.");
            console.error("Could not confirm email:", e);
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <div className='absolute left-5 top-10 text-white text-2xl' onClick={handleReturn}>{'< Back'}</div>
            <h1 className='text-2xl'>Please enter the confirmation code sent to your email:</h1>
            <div className="flex h-8 w-120 items-center cursor-pointer">
                <img src={mailIcon} className="border border-background-secondary rounded-l-md h-full" />
                <input placeholder="Confirmation Code" className="flex-1 bg-background-primary border border-background-secondary rounded-r-md h-full" type='number' value={code}
                    onChange={(e) => setCode(Number(e.target.value))} />
            </div>
            <div className='flex gap-2'>
                <button className="rounded-md border border-button-secondary bg-button-secondary text-white text-xl px-8 w-50 hover:bg-button-secondary/50 disabled:bg-button-secondary/40 disabled:w-60" onClick={handleResendConfirmation} disabled={resendTime !== 0}>
                    Resend Code {resendTime !== 0 && `${resendTime}`}
                </button>
                <button className="rounded-md border border-button-primary bg-button-primary text-white text-xl px-8 w-50 hover:bg-button-primary/50" onClick={handleConfirmation}>Submit</button>
            </div>
        </div >
    );
}

export default EmailConfirmation
