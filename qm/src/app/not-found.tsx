import { ErrorState, HomeLink, NOT_FOUND_COPY } from "@/components/error-state";

export default function NotFound() {
  return (
    <ErrorState title={NOT_FOUND_COPY.title} body={NOT_FOUND_COPY.body}>
      <HomeLink primary />
    </ErrorState>
  );
}
