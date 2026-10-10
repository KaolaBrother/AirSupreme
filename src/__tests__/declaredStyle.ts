/**
 * 代码给元素声明的内联样式，原样读出来。
 *
 * jsdom 的样式解析器（cssstyle）有两处与浏览器不同，直接读 element.style 会读不到：
 * - 整段写 `style.cssText = …` 时，个别写法（`background: transparent`、带 var() 的 border 简写）
 *   会让它把整段都丢掉，元素上一条内联样式也不剩；
 * - 它不认识的属性（touch-action、-webkit-user-select …）被单独丢掉。
 * 浏览器两种情况都照常应用。所以这里把写进 cssText 的原文记下来，读的时候先看 element.style，
 * 读不到再回到原文里找。
 */

export interface DeclaredStyles {
  /** 某个属性（连字符写法，如 'z-index'）声明的值；没有声明返回 '' */
  of(element: HTMLElement | SVGElement, property: string): string;
  /** 还原 cssText 的写入 */
  stop(): void;
}

/** 按分号拆开一段声明（括号里的分号不算），后写的覆盖先写的 */
function parseDeclarations(cssText: string): Map<string, string> {
  const declarations = new Map<string, string>();
  let depth = 0;
  let current = '';
  const flush = (): void => {
    const colon = current.indexOf(':');
    if (colon > 0) {
      const name = current.slice(0, colon).trim().toLowerCase();
      const value = current
        .slice(colon + 1)
        .replace(/\s*!important\s*$/i, '')
        .trim();
      if (name !== '' && value !== '') declarations.set(name, value);
    }
    current = '';
  };
  for (const char of cssText) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ';' && depth === 0) {
      flush();
    } else {
      current += char;
    }
  }
  flush();
  return declarations;
}

const camelCase = (property: string): string =>
  property.replace(/^-/, '').replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

/** 开始记录。要在被测对象创建之前调用，测试结束时 stop()。 */
export function recordDeclaredStyles(): DeclaredStyles {
  const descriptor = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText');
  if (!descriptor?.set || !descriptor.get) {
    throw new Error('CSSStyleDeclaration.prototype.cssText is not an accessor in this environment');
  }
  const originalSet = descriptor.set;
  const written = new WeakMap<object, string>();
  Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', {
    ...descriptor,
    set(this: CSSStyleDeclaration, value: string) {
      written.set(this, String(value));
      originalSet.call(this, value);
    },
  });

  return {
    of(element, property) {
      const style = element.style;
      const live = style.getPropertyValue(property).trim();
      if (live !== '') return live;
      // 解析器不认识的属性按普通字段留在 style 对象上（style.touchAction = 'none'）
      const field = (style as unknown as Record<string, unknown>)[camelCase(property)];
      if (typeof field === 'string' && field.trim() !== '') return field.trim();
      const raw = written.get(style);
      return raw === undefined ? '' : (parseDeclarations(raw).get(property) ?? '');
    },
    stop() {
      Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', descriptor);
    },
  };
}
