import { useMutation, useQueryClient } from '@tanstack/react-query';

/** An admin write; every query reloads after it, the sidebar's counts too. */
export function useAdminWrite<I, O>(write: (input: I) => Promise<O>, onDone?: (output: O) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSuccess: async (output) => {
      onDone?.(output);
      await queryClient.invalidateQueries();
    },
  });
}
