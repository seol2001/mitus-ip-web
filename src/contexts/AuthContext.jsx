import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

const generateRandomUserId = () => {
  // User_XXXXX 형식의 랜덤 ID 생성 (숫자 5자리)
  const random = Math.floor(10000 + Math.random() * 90000);
  return `User_${random}`;
};

export const AuthProvider = ({ children }) => {
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return sessionStorage.getItem('mitus_authorized') === 'true';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    let user = localStorage.getItem('mitus_current_user');
    if (!user) {
      user = generateRandomUserId();
      localStorage.setItem('mitus_current_user', user);
    }
    return user;
  });

  const login = () => {
    setIsAuthorized(true);
    sessionStorage.setItem('mitus_authorized', 'true');
  };

  const logout = () => {
    setIsAuthorized(false);
    sessionStorage.removeItem('mitus_authorized');
  };

  return (
    <AuthContext.Provider value={{ isAuthorized, currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
