export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-timber-900/50" onClick={onClose} />
      <div
        className={`relative bg-white shadow-xl w-full border border-timber-100 ${
          wide ? 'max-w-3xl' : 'max-w-lg'
        } max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-timber-100">
          <h2 className="text-lg font-semibold text-timber-900">{title}</h2>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
