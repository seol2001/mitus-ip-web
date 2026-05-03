import React, { createContext, useContext, useState, useCallback } from 'react';
import CommonConfirmModal from '../components/CommonConfirmModal';

const ConfirmContext = createContext();

export const ConfirmProvider = ({ children }) => {
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
    confirmText: "확인",
    cancelText: "취소",
    showCancel: true,
    resolve: null,
  });

  const showConfirm = useCallback((config) => {
    return new Promise((resolve) => {
      setModalConfig({
        isOpen: true,
        title: config.title || "확인",
        message: config.message || "",
        type: config.type || "info",
        confirmText: config.confirmText || "확인",
        cancelText: config.cancelText || "취소",
        showCancel: config.showCancel !== undefined ? config.showCancel : true,
        resolve: resolve,
      });
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setModalConfig(prev => {
      if (prev.resolve) prev.resolve(false);
      return { ...prev, isOpen: false, resolve: null };
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setModalConfig(prev => {
      if (prev.resolve) prev.resolve(true);
      return { ...prev, isOpen: false, resolve: null };
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ showConfirm }}>
      {children}
      <CommonConfirmModal 
        {...modalConfig} 
        onClose={closeConfirm}
        onConfirm={handleConfirm}
      />
    </ConfirmContext.Provider>
  );
};


export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.showConfirm;
};
