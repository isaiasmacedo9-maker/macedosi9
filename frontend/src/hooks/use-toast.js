// This file uses Sonner for toasts as defined in App.js
// The toast implementation is handled by the Sonner Toaster component
export const useToast = () => {
  return {
    toast: () => {
      console.log('Toast functionality provided by Sonner component in App.js');
    }
  };
};