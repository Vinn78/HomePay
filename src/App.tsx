import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Login } from './components/Auth/Login';
import { SignUp } from './components/Auth/SignUp';
import { Layout } from './components/Layout/Layout';
import { Home } from './components/Dashboard/Home';
import { Requests } from './components/Dashboard/Requests';
import { SendRequest } from './components/Dashboard/SendRequest';
import { Profile } from './components/Dashboard/Profile';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Home />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/send" element={<SendRequest />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}
