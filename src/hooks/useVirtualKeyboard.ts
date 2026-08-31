import { useEffect, useState } from 'react';

export function useVirtualKeyboard() {
  const [viewportHeight, setViewportHeight] = useState<number>(() =>
    typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.height : 0
  );
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      if (!window.visualViewport) return;
      const currentHeight = window.visualViewport.height;
      setViewportHeight(currentHeight);

      // If visual viewport is significantly smaller than window height, keyboard is up
      const keyboardOpen = window.innerHeight - currentHeight > 140;
      setIsKeyboardVisible(keyboardOpen);

      if (keyboardOpen && document.activeElement) {
        const tag = document.activeElement.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          setTimeout(() => {
            document.activeElement?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }, 80);
        }
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  return { viewportHeight, isKeyboardVisible };
}
