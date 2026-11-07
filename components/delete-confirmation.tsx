"use client";

import { useEffect, useId, useRef } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

export function DeleteConfirmation({
  title,
  description,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  pending: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-6 text-[#2f241e] shadow-2xl backdrop:bg-[#2f241e]/40"
    >
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#fde5dd] text-[#933f30]">
        <Trash2 aria-hidden="true" className="h-6 w-6" />
      </div>
      <h2 id={headingId} className="break-words text-xl font-bold">{title}</h2>
      <p className="mt-3 text-base leading-7 text-[#705c4d]">{description}</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#fde5dd] p-3 text-sm text-[#933f30]">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button ref={cancelRef} type="button" disabled={pending} onClick={onClose} className="min-h-12 rounded-xl border border-[#dfd0c2] px-5 text-sm font-semibold disabled:opacity-50">ยกเลิก</button>
        <button type="button" disabled={pending} onClick={onConfirm} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#a34235] px-5 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}
          {pending ? "กำลังลบ…" : "ยืนยันลบถาวร"}
        </button>
      </div>
    </dialog>
  );
}
