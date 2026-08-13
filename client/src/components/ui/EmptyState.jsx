export default function EmptyState({ title, subtitle, action }) {
  return (
    <div className="px-4 py-20 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-timber-400">
        FutureFit
      </p>
      <h3 className="mt-3 font-display text-3xl font-medium tracking-tight text-timber-900 sm:text-4xl">
        {title}
      </h3>
      {subtitle && (
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-timber-500">{subtitle}</p>
      )}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}
