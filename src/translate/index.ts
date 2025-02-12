import { noCase, snakeCase } from "change-case";
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

  private get config() {
    return workspace.getConfiguration('varTranslation');
  }
  private get isChinese() {
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
    window.setStatusBarMessage(`${packageJSON.displayName}: ${message}`, 2000);
  }

  async translate(text: string): Promise<string> {
    this.text = text.trim();
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
        ? noCase(this.text)
        : this.text;

      this.showStatus(`${this.engine} 翻译中: ${this.text} → ${this.targetLang}`);
      const { text: result } = await engine(processedText, this.targetLang);

      this.cache.set(cacheKey, {
        engine: this.engine,
        key: this.cacheKey,
        result
      });

      return result;
    } catch (error: any) {
      this.showStatus(`翻译失败: ${error.message}`);
      return '';
    }
  }
}

export default VarTranslator;
