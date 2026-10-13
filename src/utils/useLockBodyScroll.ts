import { useEffect } from 'react';

// 全局引用计数：支持多层弹窗嵌套打开与关闭，只有所有弹窗全部关闭时才解除 body 滚动锁定
let lockCount = 0;

export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    lockCount++;
    document.body.classList.add('modal-open');
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.classList.remove('modal-open');
      }
    };
  }, [locked]);
}
