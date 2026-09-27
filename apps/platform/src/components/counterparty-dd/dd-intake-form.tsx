import { useState } from "react"
import { createProjectSchema } from "@talasa/shared"
import type { CompanySearchResult, CreateProjectInput } from "@talasa/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useEquasisCompanySearch } from "@/hooks/use-equasis-search"
import { cn } from "@/lib/utils"

/**
 * Intake for a new counterparty check. The broker types a company name and
 * runs an explicit Equasis search (never search-as-you-type — the account is
 * rate-limited), picks the matching company, and screens that exact entity.
 * When Equasis returns nothing (or is unavailable) they can fall back to
 * screening the typed name alone.
 */
export function DDIntakeForm({
  pending,
  onSubmit,
}: {
  pending: boolean
  onSubmit: (input: CreateProjectInput) => void
}) {
  const search = useEquasisCompanySearch()
  const [query, setQuery] = useState("")
  // The term actually searched, frozen at Search time. The no-match fallback and
  // its payload screen THIS — never whatever the box was later edited to.
  const [searchedTerm, setSearchedTerm] = useState("")
  const [notes, setNotes] = useState("")
  // The entity the broker chose. A `CompanySearchResult` for a real Equasis
  // hit; `"free-text"` when they opted to screen the typed name with no match.
  const [selected, setSelected] = useState<CompanySearchResult | "free-text" | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const results = search.data
  const trimmedQuery = query.trim()

  function runSearch() {
    if (!trimmedQuery || search.isPending) return
    setSelected(null)
    setSearchedTerm(trimmedQuery)
    setFormError(null)
    // Errors are surfaced via `search.error`; swallow the rejection here.
    search.mutateAsync(trimmedQuery).catch(() => {})
  }

  // Editing the box invalidates any prior pick/fallback, so a stale selection can
  // never be submitted against an edited query (and Run re-disables until the
  // broker searches + picks again).
  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    if (selected) setSelected(null)
    if (formError) setFormError(null)
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      runSearch()
    }
  }

  function selectFreeText() {
    setSelected("free-text")
    setFormError(null)
  }

  function handleRun() {
    if (!selected) return

    const trimmedNotes = notes.trim()
    const payload: Record<string, unknown> =
      selected === "free-text"
        ? { counterpartyName: searchedTerm, name: searchedTerm }
        : {
            counterpartyName: selected.name,
            name: selected.name,
            companyImo: selected.id,
            // Truncate to the schema bound so a real pick with an unusually long
            // address can never be rejected at submit (address is informational).
            companyAddress: selected.address ? selected.address.slice(0, 300) : undefined,
          }
    if (trimmedNotes) payload.notes = trimmedNotes

    const parsed = createProjectSchema.safeParse(payload)
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Invalid selection")
      return
    }

    setFormError(null)
    onSubmit(parsed.data)
  }

  const searchFailed = search.isError
  const noMatches = results !== undefined && results.length === 0

  return (
    <div className="flex flex-col gap-4">
      {/* Search field — the primary input. Explicit-action search only. */}
      <div className="grid gap-1.5">
        <Label htmlFor="companyName">Company name</Label>
        <div className="flex items-center gap-2">
          <Input
            id="companyName"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search for the counterparty company"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            onClick={runSearch}
            disabled={!trimmedQuery || search.isPending}
          >
            {search.isPending ? "Searching…" : "Search"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Search, then pick the exact company to screen.
        </p>
      </div>

      {/* Results, no-match fallback, or search error */}
      {search.isPending ? (
        <p className="text-sm text-muted-foreground">Searching…</p>
      ) : searchFailed ? (
        <div className="grid gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">
            Company search is unavailable right now.
          </p>
          {searchedTerm ? (
            <Button type="button" variant="outline" onClick={selectFreeText}>
              Screen &ldquo;{searchedTerm}&rdquo; without a registry match
            </Button>
          ) : null}
        </div>
      ) : noMatches ? (
        <div className="grid gap-2 rounded-lg border p-3">
          <p className="text-sm text-muted-foreground">
            No companies matched &ldquo;{searchedTerm}&rdquo;.
          </p>
          <Button type="button" variant="outline" onClick={selectFreeText}>
            Screen &ldquo;{searchedTerm}&rdquo; without a registry match
          </Button>
        </div>
      ) : results && results.length > 0 ? (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2">
            {results.map((c) => {
              const isSelected = selected !== "free-text" && selected?.id === c.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(c)
                      setFormError(null)
                    }}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      isSelected
                        ? "border-ring ring-3 ring-ring/50"
                        : "border-input hover:bg-muted/50"
                    )}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {c.address ?? "address unknown"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {/* Escape hatch when none of the hits is the right entity. */}
          <button
            type="button"
            onClick={selectFreeText}
            className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            None of these? Screen &ldquo;{searchedTerm}&rdquo; as typed
          </button>
        </div>
      ) : null}

      {/* Selected-company confirmation */}
      {selected ? (
        <div className="grid gap-0.5 rounded-lg border border-ring bg-muted/30 p-3">
          <span className="text-xs font-medium text-muted-foreground">Screening</span>
          {selected === "free-text" ? (
            <>
              <span className="font-medium">{searchedTerm}</span>
              <span className="text-sm text-muted-foreground">
                typed name — no registry match
              </span>
            </>
          ) : (
            <>
              <span className="font-medium">{selected.name}</span>
              <span className="text-sm text-muted-foreground">
                {selected.address ?? "address unknown"}
              </span>
            </>
          )}
        </div>
      ) : null}

      {/* Optional broker notes */}
      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Private context for this check"
        />
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button
        type="button"
        onClick={handleRun}
        disabled={pending || !selected || (selected === "free-text" && !searchedTerm)}
      >
        {pending ? "Running…" : "Run due diligence"}
      </Button>
    </div>
  )
}
