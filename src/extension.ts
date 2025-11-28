import { window, ExtensionContext, commands, QuickPickItem, Selection, ProgressLocation } from 'vscode';
import { changeCaseMap } from './utils';
import AsyncQuickPick from './utils/asyncPick';
import VarTranslate from './translate';


export let packageJSON: any;
const varTranslate = new VarTranslate()

const checkUpdate = async (context: ExtensionContext) => {
  const { globalState } = context;
  const CACHE_KEY_PREFIX = `${packageJSON.name}-version`;
  const lastCheckedVersion = globalState.get<string>(CACHE_KEY_PREFIX);
  const currentVersion = packageJSON.version;
  if (lastCheckedVersion !== currentVersion) {
    globalState.update(CACHE_KEY_PREFIX, currentVersion);

    const updateContent = `
   **${packageJSON.displayName} 更新**:
    - 异步英汉优化互译响应 提高直接转换的使用体验
    - 修复英文单词缓存
    `;
    window.showInformationMessage(updateContent)
  }
};

export function activate(context: ExtensionContext) {
  packageJSON = context.extension.packageJSON;
  checkUpdate(context);
  context.subscriptions.push(commands.registerCommand('extension.varTranslation', main));
  changeCaseMap.forEach((item) => {
    context.subscriptions.push(commands.registerCommand(`extension.varTranslation.${item.name}`, () => typeTranslation(item.name)));
  });
}

export function deactivate() { }

/**
 * 执行选择替换操作
 * @param word 需要处理的单词
 * @param quickPickItems 可选的快速选择项
 * @returns 用户选择的文本
 */
const quickPick = new AsyncQuickPick();
const selectAndReplace = async (word: string, quickPickItems: QuickPickItem[] = [], async?: boolean): Promise<string | undefined> => {
  const wordItems = changeCaseMap.map((item) => ({ label: item.handle(word), description: item.description }));
  const items: QuickPickItem[] = [...wordItems, ...quickPickItems];
  return quickPick.showQuickPick(items, async)
};

/**
 * 编辑器中替换选中的文本
 * @param editor 编辑器实例
 * @param selection 选中的范围
 * @param newText 替换后的文本
 */
const replaceTextInEditor = (editor: any, selection: any, newText: string) => {
  editor.edit((builder: any) => builder.replace(selection, newText));
};

/** 展示用户选择框 */
const showSelectAndReplace = async (selection: Selection, selected: string) => {
  const editor = window.activeTextEditor;
  if (!editor) return;
  const handleReplace = async (userSelected: string | undefined) => {
    if (userSelected) {
      replaceTextInEditor(editor, selection, userSelected);
    }
  };
  /* 更新需要翻译的词 */
  varTranslate.setText(selected);
  const isZh = varTranslate.isChinese;
  /* 中文情况下 需要先翻译成英文 再转换 */
  if (isZh) {
    // 先立刻展示一个占位的 QuickPick，让用户看到界面响应，并保持同一个 QuickPick 动态更新
    const wordItems = changeCaseMap.map((item) => ({ label: item.handle(selected), description: item.description }));
    const initialItems: QuickPickItem[] = [...wordItems, { label: '正在翻译中', description: '翻译' }];
    quickPick.showQuickPick(initialItems, true).then(handleReplace);

    // 带进度的翻译并支持重试
    const doTranslateWithRetry = async (): Promise<string> => {
      while (true) {
        const translated = await window.withProgress({ location: ProgressLocation.Notification, title: '翻译中', cancellable: true }, async () => {
          return await varTranslate.translate();
        });
        if (translated) return translated;
        const pick = await window.showErrorMessage('翻译失败或超时', '重试', '取消');
        if (pick === '重试') continue;
        return '';
      }
    };

    const translated = await doTranslateWithRetry();
    if (translated) {
      const newItems = changeCaseMap.map((item) => ({ label: item.handle(translated), description: item.description }));
      quickPick.updateItems([...newItems, { label: translated, description: '翻译' }]);
    } else {
      quickPick.updateItems([...wordItems, { label: '翻译失败', description: '翻译' }]);
    }
  } else {
    /* 英文先出格式转换 再异步等结果 */
    const wordItems = changeCaseMap.map((item) => ({ label: item.handle(selected), description: item.description }));
    const initialItems: QuickPickItem[] = [...wordItems, { label: '正在翻译中', description: '翻译' }];
    quickPick.showQuickPick(initialItems, true).then(handleReplace);

    const doTranslateWithRetry = async (): Promise<string> => {
      while (true) {
        const translated = await window.withProgress({ location: ProgressLocation.Notification, title: '翻译中', cancellable: true }, async () => {
          return await varTranslate.translate();
        });
        if (translated) return translated;
        const pick = await window.showErrorMessage('翻译失败或超时', '重试', '取消');
        if (pick === '重试') continue;
        return '';
      }
    };

    const translated = await doTranslateWithRetry();
    if (translated) {
      const newItems = changeCaseMap.map((item) => ({ label: item.handle(translated), description: item.description }));
      quickPick.updateItems([...newItems, { label: translated, description: '翻译' }]);
    } else {
      quickPick.updateItems([...wordItems, { label: '翻译失败', description: '翻译' }]);
    }
  }
};

/**
 * 主翻译逻辑
 */
const main = async () => {
  const editor = window.activeTextEditor;
  if (!editor) return;
  for (const selection of editor.selections) {
    const selected = editor.document.getText(selection);
    showSelectAndReplace(selection, selected);
  }
};

/**
 * 转换变量名格式
 */
const typeTranslation = async (type: string) => {
  const changeCase = changeCaseMap.find((item) => item.name === type);
  if (!changeCase) return;

  const editor = window.activeTextEditor;
  if (!editor) return;

  for (const selection of editor.selections) {
    const selected = editor.document.getText(selection);
    varTranslate.setText(selected);
    const isZh = varTranslate.isChinese;
    const word = isZh ? await varTranslate.translate() : selected;
    if (word) {
      replaceTextInEditor(editor, selection, changeCase.handle(word));
    }
  }
};
