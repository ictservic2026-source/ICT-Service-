export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 text-4xl opacity-80">{icon}</div>}
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {hint && <p className="max-w-sm text-sm text-sub">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
