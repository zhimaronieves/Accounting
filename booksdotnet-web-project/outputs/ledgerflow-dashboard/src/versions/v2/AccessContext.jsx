import { createContext, useContext } from 'react';
export const PageContext = createContext(null);
export const usePageAccess = () => useContext(PageContext)?.can || (() => true);
