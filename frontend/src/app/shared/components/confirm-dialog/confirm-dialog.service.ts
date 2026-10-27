import { Injectable, signal } from '@angular/core';

export type ConfirmTone = 'live' | 'danger' | 'neutral';

export interface ConfirmRequest {
  /** Short question, e.g. "Apply changes to the live site?" */
  title: string;
  /** One line on what actually happens if they go ahead. */
  message: string;
  /** Optional bullet list of the specific things changing. */
  changes?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

/**
 * App-wide confirmation gate.
 *
 * Admin edits reach the public site the moment they save, so anything
 * user-visible or destructive routes through here first. Call `ask()` and await
 * the result; the dialog itself is rendered once by the admin shell.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  /** The dialog currently on screen, if any. Read by ConfirmDialogComponent. */
  readonly pending = signal<PendingConfirm | null>(null);

  /** Resolves true if the admin confirms, false if they cancel or dismiss. */
  ask(request: ConfirmRequest): Promise<boolean> {
    // A second ask() while one is open would strand the first promise: resolve it.
    this.pending()?.resolve(false);
    return new Promise<boolean>((resolve) => {
      this.pending.set({ ...request, resolve });
    });
  }

  /** Convenience for the common "this edits the live website" case. */
  askLiveChange(what: string, changes?: string[]): Promise<boolean> {
    return this.ask({
      title: 'Apply changes to the live site?',
      message: `${what} updates for all visitors immediately.`,
      changes,
      confirmLabel: 'Apply to live',
      tone: 'live',
    });
  }

  /** Convenience for deletes and other destructive, hard-to-undo actions. */
  askDelete(what: string, message?: string): Promise<boolean> {
    return this.ask({
      title: `Delete ${what}?`,
      message: message ?? 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
  }

  resolve(ok: boolean): void {
    const p = this.pending();
    if (!p) return;
    this.pending.set(null);
    p.resolve(ok);
  }
}
