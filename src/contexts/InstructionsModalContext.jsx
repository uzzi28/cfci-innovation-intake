import React, { createContext, useContext } from 'react';

const InstructionsModalContext = createContext({
  openInstructions: () => {},
});

export function InstructionsModalProvider({ children, openInstructions }) {
  return (
    <InstructionsModalContext.Provider value={{ openInstructions }}>
      {children}
    </InstructionsModalContext.Provider>
  );
}

export function useInstructionsModal() {
  return useContext(InstructionsModalContext);
}
