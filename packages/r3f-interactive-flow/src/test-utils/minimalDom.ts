type ListenerRecord = {
  listener: EventListenerOrEventListenerObject;
};

type MinimalDispatchEvent = {
  defaultPrevented?: boolean;
  target?: EventTarget | MinimalEventTarget | null;
  readonly type: string;
};

export class MinimalEventTarget {
  private listeners = new Map<string, ListenerRecord[]>();

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    // React passes listener options here; the minimal target only needs to retain listeners.
    _listenerOptions?: AddEventListenerOptions | boolean
  ): void {
    void _listenerOptions;

    if (listener === null) {
      return;
    }

    this.listeners.set(type, [...(this.listeners.get(type) ?? []), { listener }]);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener === null) {
      return;
    }

    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((record) => record.listener !== listener)
    );
  }

  dispatchEvent(event: MinimalDispatchEvent): boolean {
    event.target ??= this;

    for (const { listener } of this.listeners.get(event.type) ?? []) {
      if (typeof listener === "function") {
        listener.call(this, event as unknown as Event);
      } else {
        listener.handleEvent(event as unknown as Event);
      }
    }

    return !event.defaultPrevented;
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.length ?? 0;
  }

  clearListeners(): void {
    this.listeners.clear();
  }
}

export class MinimalNode extends MinimalEventTarget {
  childNodes: MinimalNode[] = [];
  nodeType = 0;
  nodeName = "";
  ownerDocument: MinimalDocument | null = null;
  parentNode: MinimalNode | null = null;

  appendChild(node: MinimalNode): MinimalNode {
    this.childNodes.push(node);
    node.parentNode = this;

    return node;
  }

  append(...nodes: MinimalNode[]): void {
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  remove(): void {
    this.parentNode?.removeChild(this);
  }

  insertBefore(node: MinimalNode, beforeNode: MinimalNode | null): MinimalNode {
    const index = beforeNode === null ? -1 : this.childNodes.indexOf(beforeNode);

    if (index === -1) {
      return this.appendChild(node);
    }

    this.childNodes.splice(index, 0, node);
    node.parentNode = this;

    return node;
  }

  removeChild(node: MinimalNode): MinimalNode {
    this.childNodes = this.childNodes.filter((child) => child !== node);
    node.parentNode = null;

    return node;
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    const text = this.ownerDocument?.createTextNode(value) ?? new MinimalText(value);
    this.childNodes = [text];
    text.parentNode = this;
  }
}

export class MinimalText extends MinimalNode {
  data: string;

  constructor(data: string) {
    super();
    this.data = data;
    this.nodeType = 3;
    this.nodeName = "#text";
  }

  override get textContent(): string {
    return this.data;
  }

  override set textContent(value: string) {
    this.data = value;
  }
}

export class MinimalElement extends MinimalNode {
  attributes: Record<string, string> = {};
  isContentEditable = false;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  style: Record<string, string> = {};
  tagName: string;

  constructor(tagName: string) {
    super();
    this.nodeType = 1;
    this.nodeName = tagName.toUpperCase();
    this.tagName = this.nodeName;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;

    if (name === "contenteditable") {
      this.isContentEditable = value !== "false";
    }
  }

  removeAttribute(name: string): void {
    delete this.attributes[name];

    if (name === "contenteditable") {
      this.isContentEditable = false;
    }
  }

  closest(selector: string): MinimalElement | null {
    function findClosest(current: MinimalNode | null): MinimalElement | null {
      if (current === null) {
        return null;
      }

      if (current instanceof MinimalElement && current.matches(selector)) {
        return current;
      }

      return findClosest(current.parentNode);
    }

    return findClosest(this);
  }

  matches(selector: string): boolean {
    if (selector.startsWith(".")) {
      return (this.attributes.class ?? "").split(/\s+/u).includes(selector.slice(1));
    }

    if (selector.startsWith("#")) {
      return this.attributes.id === selector.slice(1);
    }

    return this.tagName.toLowerCase() === selector.toLowerCase();
  }
}

export class MinimalDocument extends MinimalNode {
  body: MinimalElement;
  defaultView = globalThis;
  documentElement: MinimalElement;

  constructor() {
    super();
    this.nodeType = 9;
    this.nodeName = "#document";
    this.ownerDocument = this;
    this.documentElement = this.createElement("html");
    this.body = this.createElement("body");
  }

  createElement(tagName: string): MinimalElement {
    const element = new MinimalElement(tagName);
    element.ownerDocument = this;

    return element;
  }

  createElementNS(namespaceURI: string, tagName: string): MinimalElement {
    const element = this.createElement(tagName);
    element.namespaceURI = namespaceURI;

    return element;
  }

  createTextNode(data: string): MinimalText {
    const text = new MinimalText(data);
    text.ownerDocument = this;

    return text;
  }
}

export const windowTarget = new MinimalEventTarget();

type MinimalDomEventClasses = Partial<{
  KeyboardEvent: typeof globalThis.KeyboardEvent;
  TouchEvent: typeof globalThis.TouchEvent;
  WheelEvent: typeof globalThis.WheelEvent;
}>;

export function installMinimalDom(eventClasses: MinimalDomEventClasses = {}): void {
  const document = new MinimalDocument();

  Object.assign(globalThis, {
    document,
    window: globalThis,
    Document: MinimalDocument,
    Element: MinimalElement,
    HTMLElement: MinimalElement,
    HTMLIFrameElement: class MinimalHTMLIFrameElement extends MinimalElement {},
    Node: MinimalNode,
    SVGElement: MinimalElement,
    addEventListener: windowTarget.addEventListener.bind(windowTarget),
    removeEventListener: windowTarget.removeEventListener.bind(windowTarget),
    dispatchEvent: windowTarget.dispatchEvent.bind(windowTarget),
    ...eventClasses
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { userAgent: "node" }
  });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
}
