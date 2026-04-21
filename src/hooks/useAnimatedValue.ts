import { useState, useEffect } from 'react';

export function useAnimatedValue(target: number, delay = 150) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setValue(target), delay);
    return () => clearTimeout(t);
  }, [target, delay]);
  return value;
}
