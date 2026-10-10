import { Button } from "./Button";

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages < 2) return null;
  return <nav className="mt-6 flex items-center justify-between gap-3" aria-label="페이지 이동"><Button variant="secondary" disabled={page <= 0} onClick={() => onChange(page - 1)}>이전</Button><span className="text-sm tabular-nums text-brown-500">{page + 1} / {totalPages}</span><Button variant="secondary" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>다음</Button></nav>;
}
