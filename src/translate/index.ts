import { capitalCase, snakeCase } from "change-case";
import { window, workspace } from "vscode";
import { isChinese } from "../utils";
import translatePlatforms, { EengineType } from "./engine";
import { packageJSON } from "../extension";

type Language = 'zh' | 'en';
interface CacheItem {
  engine: EengineType;
  key: string;
  result: string;
}

const LANGUAGE = {
  ZH: 'zh' as Language,
  EN: 'en' as Language,
};

class VarTranslator {
  private text = '';
  private cache = new Map<string, CacheItem>();
  private config = workspace.getConfiguration('varTranslation')
  constructor() {
    // 注册配置更改监听器
    workspace.onDidChangeConfiguration((event) => {
      // 检查特定配置项是否被修改
      if (event.affectsConfiguration('varTranslation')) {
        this.config = workspace.getConfiguration('varTranslation')
        this.showStatus(`用户更新配置`);
      }
    });
  }
  get isChinese() {
    return isChinese(this.text);
  }

  private get targetLang(): Language {
    return this.isChinese ? LANGUAGE.EN : LANGUAGE.ZH;
  }

  private get cacheKey() {
    return this.targetLang === LANGUAGE.ZH
      ? snakeCase(this.text)
      : this.text;
  }

  private get engine(): EengineType {
    return this.config.translationEngine;
  }

  private showStatus(message: string) {
    const msg = `${packageJSON.displayName}: ${message}`
    console.log(msg)
    window.setStatusBarMessage(msg, 2000);
  }
  setText(text: string) {
    this.text = text.trim();
  }
  async translate(): Promise<string> {
    if (!this.text) return '';
    const cacheKey = `${this.engine}_${this.cacheKey}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.showStatus(`使用缓存: ${this.text}`);
      return cached.result;
    }

    try {
      const engine = translatePlatforms[this.engine] || translatePlatforms.google;
      const processedText = this.targetLang === LANGUAGE.ZH
        ? capitalCase(this.text)
        : this.text;

      this.showStatus(`${this.engine}翻译: ${processedText} 到 ${this.targetLang}`);
      let { text: result } = await engine(processedText, this.targetLang);
      result=result.replace(/["\n\r]/g, '')
      if (result) {
        this.cache.set(cacheKey, {
          engine: this.engine,
          key: this.cacheKey,
          result
        });
      }
      return result;
    } catch (error: any) {
      this.showStatus(`翻译失败: ${error.message}`);
      return '';
    }
  }
}

export default VarTranslator;
