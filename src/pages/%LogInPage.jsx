import React, { useState } from 'react';
import Login from '../components/auth/Login';
import '../components/auth/Auth.css';

const LoginPage = () => {
    return (
        <div className="auth-container">
            <div className="auth-page-wrapper">
            <header className="auth-header">
                <h1 className="auth-title">Welcome Back, Adventurer</h1>
                <p className="auth-subtitle">Continue your journey where you left off</p>
            </header>
            <Login/>
            </div>
        </div>
    );
    

}

export default LoginPage;