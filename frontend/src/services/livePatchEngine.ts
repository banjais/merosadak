type PatchAction = "replace" | "style" | "hide" | "show";

type Patch = {
  type: "PATCH";
  target: string; // e.g. "Header.title"
  action: PatchAction;
  value?: any;
};

class LivePatchEngineClass {
  applyPatch(patch: Patch) {
    const el = document.querySelector(`[data-patch="${patch.target}"]`);

    if (!el) return;

    switch (patch.action) {
      case "replace":
        el.textContent = patch.value;
        break;

      case "style":
        Object.assign((el as HTMLElement).style, patch.value);
        break;

      case "hide":
        (el as HTMLElement).style.display = "none";
        break;

      case "show":
        (el as HTMLElement).style.display = "block";
        break;
    }
  }

  applyBatch(patches: Patch[]) {
    patches.forEach((p) => this.applyPatch(p));
  }
}

export const LivePatchEngine = new LivePatchEngineClass();