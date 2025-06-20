import { showToast as showToastFn } from '../components/Toaster';

export function useToast() {
  return {
    showToast: showToastFn
  };
}