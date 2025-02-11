import { QuickPickItem, window } from "vscode"
class AsyncQuickPick {
  cacheIndex = 0;
  visible = false;
  quickPick;
  constructor() {
    this.quickPick = window.createQuickPick()
  }
  show() {
    this.quickPick.show();
    this.visible = true
  }
  hide() {
    this.quickPick.hide()
    this.visible = false
  }
  showQuickPick(items: QuickPickItem[], async?: boolean): Promise<string | undefined> {
    const { quickPick } = this;
    quickPick.matchOnDescription = true
    quickPick.placeholder = '选择替换'
    quickPick.items = items
    quickPick.activeItems = [items[this.cacheIndex]];
    /* 如果异步更新的时候 已经关闭了 就返回不处理 */
    if (async && !this.visible) return Promise.resolve(undefined)
    return new Promise((resolve, reject) => {
      // 监听用户选择
      quickPick.onDidChangeSelection((selection) => {
        if (selection.length > 0) {
          resolve(selection[0].label); // 返回选中的项
          this.hide()
        }
      });
      quickPick.onDidHide(() => {
        this.hide()
        resolve(undefined)
      });
      /* 监听用户焦点数据 */
      quickPick.onDidChangeActive((selection) => {
        const index = items.findIndex((item) => item.description === selection[0].description);
        if (index) this.cacheIndex = index;
      });
      // 显示 QuickPick
      this.show();
    });
  }
}


export default AsyncQuickPick
