import { window, ExtensionContext, commands, QuickPickItem, Selection } from 'vscode';
import { changeCaseMap, isChinese } from './utils';
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
/** 展示用户选择框 */
const showSelectAndReplace = async (word: string, selection: Selection, translated: string | Promise<string>) => {
  const editor = window.activeTextEditor;
  if (!editor) return;

  const handleReplace = async (userSelected: string | undefined) => {
    if (userSelected) { replaceTextInEditor(editor, selection, userSelected); }
  };
  // 处理异步情况
  if (translated instanceof Promise) {
    /* 先快速输出转换 */
    selectAndReplace(word, [{ label: '正在翻译中', description: '翻译' }]).then(handleReplace);
    translated.then(asyncTranslated => selectAndReplace(word, [{ label: asyncTranslated, description: '翻译' }], true).then(handleReplace));
  } else {
    selectAndReplace(word, [{ label: translated, description: '翻译' }]).then(handleReplace);
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
    const isZh = isChinese(selected);
    const to = isZh ? 'en' : 'zh';
    // 中文情况下 需要先翻译成英文 在转换
    if (isZh) {
      const translated: string = await varTranslate.translate(selected);
      showSelectAndReplace(translated, selection, translated);
    } else {
      /*英文情况下 直接异步翻译*/
      showSelectAndReplace(selected, selection, varTranslate.translate(selected));
    }
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
    const isZh = isChinese(selected);
    const word = isZh ? await varTranslate.translate(selected) : selected;
    if (word) {
      replaceTextInEditor(editor, selection, changeCase.handle(word));
    }
  }
};
