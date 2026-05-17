import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DeviceContextType {
  isMobile: boolean;
}

const DeviceContext = createContext<DeviceContextType>({ isMobile: false });

export function useDevice() {
  return useContext(DeviceContext);
}

interface DeviceProviderProps {
  children: ReactNode;
}

function checkIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

export function DeviceProvider({ children }: DeviceProviderProps) {
  const [isMobile, setIsMobile] = useState(checkIsMobile);

  useEffect(() => {
    const handleResize = () => setIsMobile(checkIsMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <DeviceContext.Provider value={{ isMobile }}>
      {children}
    </DeviceContext.Provider>
  );
}
