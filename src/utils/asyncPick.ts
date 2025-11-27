import { QuickPickItem, window } from "vscode";

class AsyncQuickPick {
  cacheIndex = 0;
  visible = false;
  quickPick;
  // disposables for current listeners
  selectionDisposable: any = null;
  hideDisposable: any = null;
  activeDisposable: any = null;

  constructor() {
    this.quickPick = window.createQuickPick();
  }

  show() {
    this.quickPick.show();
    this.visible = true;
  }

  hide() {
    this.quickPick.hide();
    this.visible = false;
  }

  showQuickPick(items: QuickPickItem[], isAsync?: boolean): Promise<string | undefined> {
    const { quickPick } = this;
    quickPick.matchOnDescription = true;
    quickPick.placeholder = '选择替换';
    quickPick.items = items;
    quickPick.activeItems = [items[this.cacheIndex]];

    if (isAsync && !this.visible) {
      return Promise.resolve(undefined);
    }

    // 清理之前的监听
    if (this.selectionDisposable) this.selectionDisposable.dispose();
    if (this.hideDisposable) this.hideDisposable.dispose();
    if (this.activeDisposable) this.activeDisposable.dispose();

    return new Promise((resolve) => {
      // 监听用户选择
      this.selectionDisposable = quickPick.onDidChangeSelection((selection: readonly QuickPickItem[]) => {
        if (selection.length > 0) {
          resolve(selection[0].label); // 返回选中的项
          this.hide();
          // dispose listeners
          if (this.selectionDisposable) this.selectionDisposable.dispose();
          if (this.hideDisposable) this.hideDisposable.dispose();
          if (this.activeDisposable) this.activeDisposable.dispose();
        }
      });

      this.hideDisposable = quickPick.onDidHide(() => {
        this.hide();
        resolve(undefined);
        if (this.selectionDisposable) this.selectionDisposable.dispose();
        if (this.hideDisposable) this.hideDisposable.dispose();
        if (this.activeDisposable) this.activeDisposable.dispose();
      });

      // 监听用户焦点数据，更新 cacheIndex
      this.activeDisposable = quickPick.onDidChangeActive((selection: readonly QuickPickItem[]) => {
        if (!selection || selection.length === 0) return;
        const index = items.findIndex((item) => item.description === selection[0].description);
        if (index !== -1) {
          this.cacheIndex = index;
        }
      });

      // 显示 QuickPick
      this.show();
    });
  }

  // 新增：更新已经显示的 QuickPick 的 items（动态更新）
  updateItems(items: QuickPickItem[]) {
    try {
      this.quickPick.items = items;
      this.quickPick.activeItems = [items[this.cacheIndex]];
    } catch (e) {
      // ignore
    }
  }
}

export default AsyncQuickPick;
