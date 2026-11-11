import { useEffect, useRef } from "react";
import { ShieldCheck, Wallet, X } from "lucide-react";

type Props = { open: boolean; onClose: () => void };

export function ConnectDialog({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "clip";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-title"
        aria-describedby="connect-copy"
      >
        <button
          ref={closeRef}
          type="button"
          className="dialog-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={17} aria-hidden="true" />
        </button>

        <span className="dialog-icon" aria-hidden="true">
          <Wallet size={22} strokeWidth={1.8} aria-hidden="true" />
        </span>

        <h2 id="connect-title">Open Veyl in Nimiq Pay</h2>
        <p id="connect-copy">
          Veyl runs inside Nimiq Pay. Open this app in Nimiq Pay, then connect from the trade
          panel to sign with the wallet already on your account.
        </p>

        <div className="dialog-note">
          <ShieldCheck size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Your keys stay in Nimiq Pay. Veyl never holds them.</span>
        </div>
      </div>
    </div>
  );
}
