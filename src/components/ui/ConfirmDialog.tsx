'use client';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: 'primary' | 'danger' | 'success' | 'warn';
}

export function ConfirmDialog({ title, message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', tone = 'primary', onResult }: ConfirmOptions & { onResult: (v: boolean) => void }) {
  return (
    <Modal open onClose={() => onResult(false)} title={title} size="sm" z={90}
      footer={<>
        <Button variant="secondary" onClick={() => onResult(false)}>{cancelText}</Button>
        <Button variant={tone} onClick={() => onResult(true)} data-autofocus>{confirmText}</Button>
      </>}>
      <div className="text-sm leading-relaxed text-sub">{message}</div>
    </Modal>
  );
}
