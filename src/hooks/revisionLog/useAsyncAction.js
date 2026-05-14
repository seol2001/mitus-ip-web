import { useRef, useCallback, useEffect } from 'react';

/**
 * 비동기 작업의 AbortSignal 관리 및 라이프사이클을 담당하는 훅
 */
export const useAsyncAction = () => {
  const abortControllerRef = useRef(null);

  // 새로운 시그널 생성 (기존 작업 취소 포함)
  const getNewSignal = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);

  // 언마운트 시 모든 작업 취소
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * 안전한 비동기 실행 래퍼
   * @param {Function} asyncFn - 실행할 비동기 함수
   */
  const executeSafe = useCallback(async (asyncFn) => {
    const signal = getNewSignal();
    try {
      return await asyncFn(signal);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Async action aborted by user or system');
        return { aborted: true };
      }
      throw error;
    }
  }, [getNewSignal]);

  return {
    executeSafe,
    getNewSignal
  };
};
