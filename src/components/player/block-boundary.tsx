"use client";

import { Component, type ReactNode } from "react";
import { t } from "@/i18n";

/** One broken block must never take down the whole lesson. */
export class BlockErrorBoundary extends Component<{ blockId: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`Block ${this.props.blockId} failed to render`, error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="space-y-2 rounded-xl border-2 border-destructive/40 p-4">
          <p className="font-semibold">{t("player.blockError")}</p>
          <button type="button" className="min-h-11 font-semibold text-primary underline" onClick={() => this.setState({ failed: false })}>
            {t("player.tryAgain")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
