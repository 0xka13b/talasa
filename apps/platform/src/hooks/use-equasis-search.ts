import { useMutation } from "@tanstack/react-query"
import { companySearchResultSchema } from "@talasa/shared"
import type { CompanySearchResult } from "@talasa/shared"
import { apiFetch } from "@/lib/api"

/**
 * Explicit Equasis company search — a `useMutation`, not a `useQuery`, because
 * the Equasis account is aggressively rate-limited (a single shared server-side
 * client, ~1 request / 30s in prod). Search must fire only on a deliberate user
 * action (the Search button / Enter), never search-as-you-type.
 */
export function useEquasisCompanySearch() {
  return useMutation<CompanySearchResult[], Error, string>({
    mutationFn: async (name: string) =>
      companySearchResultSchema
        .array()
        .parse(await apiFetch<unknown>(`/api/equasis/company?name=${encodeURIComponent(name.trim())}`)),
  })
}
