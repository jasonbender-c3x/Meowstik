import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const {
    data: user,
    isLoading,
    error,
  } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Corrected authentication check:
  // Instead of just `!!user`, we now check for a truthy `user` object
  // AND the presence of a `user.id`. This prevents an empty object `{}`
  // from being considered a valid user.
  const isAuthenticated = !!user && !!user.id;

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
  };
}
