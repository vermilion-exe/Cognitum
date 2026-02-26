import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ChoosePath, Home, Login, MainPage, Register } from './pages';
import "./App.css";
import "katex/dist/katex.min.css";
import AppLayout from './AppLayout';
import AuthLayout from './AuthLayout';

function App() {

    return (
        <Router>
            <Routes>
                <Route element={<AuthLayout />}>
                    <Route path='/' element={<Home />} />
                    <Route path='/login' element={<Login />} />
                    <Route path='/register' element={<Register />} />
                    <Route path='/choosePath' element={<ChoosePath />} />
                </Route>
                <Route element={<AppLayout />}>
                    <Route path='/mainPage' element={<MainPage />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
