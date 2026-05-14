import { useState, useCallback } from 'react';

/**
 * Revision Log의 필터링 및 내비게이션 상태를 관리하는 훅
 */
export const useLogFilter = (initialIp = 'All', initialMode = 'new') => {
  const [ipDropdown, setIpDropdown] = useState(initialIp);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [mode, setMode] = useState(initialMode); // 'eval', 'carryover', 'new', 'fa', 'reopen'

  const handleIpChange = useCallback((newIp) => {
    setIpDropdown(newIp);
  }, []);

  const handleStatusChange = useCallback((newStatus) => {
    setStatusFilter(newStatus);
  }, []);

  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
  }, []);

  return {
    ipDropdown,
    statusFilter,
    mode,
    setIpDropdown,
    setStatusFilter,
    setMode,
    handleIpChange,
    handleStatusChange,
    handleModeChange
  };
};
