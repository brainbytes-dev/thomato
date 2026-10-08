import Link from "next/link";
import { Search } from "lucide-react";
import { FIELD, PRIMARY_BTN } from "@/components/ui/styles";
import { WISSEN_QUERY_MAX } from "@/content/wissen";
import { LINK } from "./styles";

export function SearchForm({ query }: { query: string }) {
  return (
    <form action="/wissen" method="get" role="search" aria-label="Wissen durchsuchen" className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-md">
        <span className="type-meta text-text-muted">Suche in den Zusammenfassungen</span>
        <input
          type="search"
          name="q"
          defaultValue={query}
          maxLength={WISSEN_QUERY_MAX}
          placeholder="Zum Beispiel Frist, Rekurs, Dossier"
          autoComplete="off"
          className={`${FIELD} w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className={`${PRIMARY_BTN} inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
        >
          <Search aria-hidden="true" className="size-4 shrink-0" />
          Suchen
        </button>
        {query !== "" && (
          <Link href="/wissen" className={`type-label ${LINK}`}>
            Zurücksetzen
          </Link>
        )}
      </div>
    </form>
  );
}
