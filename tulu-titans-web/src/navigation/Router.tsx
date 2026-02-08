import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import CombatScreen from '../screens/CombatScreen';
import AscensionScreen from '../screens/AscensionScreen';

const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />
        <Route path="/combat" element={<CombatScreen />} />
        <Route path="/ascension" element={<AscensionScreen />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
