import React, { useState } from 'react';
import Signup from '../components/auth/Signup';
import '../components/auth/Auth.css';

const SignupPage = () => {
    return (
        
        <div className="auth-container">
            <div className="auth-page-wrapper">
            <header className="auth-header">
                <h1 className="auth-title">Create New Account</h1>
                <p className="auth-subtitle">Get started on your motherhood adventure</p>
            </header>
            <Signup/>
         </div>
        </div>
    );
    

}

export default SignupPage;