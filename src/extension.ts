/* eslint-disable no-useless-escape */
/* eslint-disable no-await-in-loop */
import { window, ExtensionContext, commands, QuickPickItem, QuickPickOptions, workspace, Selection } from 'vscode';
import translatePlatforms, { EengineType } from './inc/translate';
import { changeCaseMap, isChinese } from './utils';
import { noCase, snakeCase } from 'change-case';
import AsyncQuickPick from './utils/asyncPIck';

interface IWordResult {
  engine: EengineType;
  srcText: string;
  result: string;
}

/** 翻译的内容缓存防止多次请求 */
const translateCacheWords: IWordResult[] = [];

let packageJSON: any;

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
 * 获取翻译结果或缓存翻译结果
 * @param srcText 原始文本
 * @param to 目标语言
 */
const getTranslation = async (srcText: string, to: string) => {
  const toZH = to === 'zh';
  /* 缓存key */
  const cacheKeyText = toZH ? snakeCase(srcText) : srcText;
  /* 翻译用 */
  const noCaseText = toZH ? noCase(srcText) : srcText;;
  const engine: EengineType = workspace.getConfiguration('varTranslation').translationEngine;
  console.log('translateCacheWords', translateCacheWords)
  const cache = translateCacheWords.find((item) => item.engine === engine && item.srcText === cacheKeyText);
  if (cache) {
    window.setStatusBarMessage(`${packageJSON.displayName} 使用缓存: ${srcText}`, 2000);
    return cache.result;
  }
  const translate = translatePlatforms[engine] || translatePlatforms.google;
  window.setStatusBarMessage(`${engine} 正在翻译到${to}: ${srcText}`, 2000);
  /* 翻译时 转换成分词的小写形式 */
  const res = await translate(noCaseText, to);
  const result = res.text;
  if (result) {
    console.log(`加入缓存: ${srcText},key:${cacheKeyText}`)
    window.setStatusBarMessage(`加入缓存: ${srcText},key:${cacheKeyText}`, 2000);
    translateCacheWords.push({ engine, srcText: cacheKeyText, result });
  }
  return result;
};

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
const showSelectAndReplace = async (word: string, selection: Selection, translated: string | Promise<string>) => {
  const editor = window.activeTextEditor;
  /* 如果是异步情况 */
  let userSelected;
  if (translated instanceof Promise) {
    selectAndReplace(word, [{ label: '正在翻译中', description: '翻译' }])
    const asyncTranslated = await translated;
    userSelected = await selectAndReplace(word, [{ label: asyncTranslated, description: '翻译' }], true);
  } else {
    selectAndReplace(word, [{ label: translated, description: '翻译' }])
  }
  if (userSelected) {
    replaceTextInEditor(editor, selection, userSelected,);
  }
}
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
      const translated: string = await getTranslation(selected, to);
      showSelectAndReplace(translated, selection, translated);
    } else {
      /*英文情况下 直接异步翻译*/
      showSelectAndReplace(selected, selection, getTranslation(selected, to));
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
    const word = isZh ? await getTranslation(selected, 'en') : selected;
    if (word) {
      replaceTextInEditor(editor, selection, changeCase.handle(word));
    }
  }
};
