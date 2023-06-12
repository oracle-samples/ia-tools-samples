/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { SAXParser, QualifiedTag } from 'sax'

/** Two-way mapping for namespaces.  You can pre-add some namespaces */
export class XmlNamespaces {
    prefixes = {};
    uris = {};

    /** Call this to reserve a specific prefix for a particular namespace. */
    add(prefix:string, uri:string) {
        this.prefixes[prefix] = uri;
        this.uris[uri] = prefix;
    }

    findUri(uri:string) {
        return (hasProp(this.uris, uri)) ? this.uris[uri] : null;
    }

    /** Find an existing prefix to refer to a namespace, or create one if none exists. */
    requirePrefix(uri:string, suggestion:string) {
        let prefix = this.findUri(uri);
        if (!prefix) {
            if (!suggestion) {
                suggestion = "$auto";
            }
            let i=1;
            prefix=suggestion;
            while(hasProp(this.prefixes, prefix)) {
                prefix = suggestion + (i++);
            }
            this.add(prefix, uri);
        }
        return prefix;
    }
}


export class XmlElement {
    children:XmlNode[] = [];
    attributes:{[name:string]:string} = {}

    public constructor(public name:string) { }

    select(initialQuery?:string) {
        const q = new XmlElements([this]);
        return (initialQuery !== undefined) ? q.select(initialQuery) : q;
    }

    selectFirst(query:string) {
        const q = new XmlElements([this]);
        return q.selectFirst(query);
    }

    text():string {
        return this.children.map(child => typeof(child) === 'string' ? child : child.text()).join("");
    }

    firstChildElement() {
        return this.childElement(0);
    }

    childElement(idx:number) {
        let foundIdx=0;
        for(const child of this.children) {
            if (child instanceof XmlElement) {
                if (foundIdx === idx) {
                    return child;
                } else {
                    foundIdx++;
                }
            }
        }
        return null;
    }

    childElements():XmlElement[] {
        return this.children.filter(child => child instanceof XmlElement) as XmlElement[];
    }
}

export type XmlNode = XmlElement | string;

function hasProp(obj:any, prop:string) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

/** Will be used for parsing when nothing else is supplied */
export const namespaces = new XmlNamespaces();

export function parseXml(xml:string, ns:XmlNamespaces = namespaces):XmlElement {
    const parser = new SAXParser(true, {xmlns:true});

    const root:XmlElement = new XmlElement("$root");
    const stack:XmlElement[] = [root]

    parser.onerror = function (e) {
        // an error happened.
        throw e.message;
    };

    parser.onopentag = function (node:QualifiedTag) {
        const top = stack[stack.length-1];

        let nodeName = node.name;
        if (node.uri) {
            nodeName = ns.requirePrefix(node.uri, node.prefix) + ":" + node.local;
        }
        const element = new XmlElement(nodeName);

        for(const attr in node.attributes) {
            if (hasProp(node.attributes, attr)) {
                const value = node.attributes[attr];
                let attrName = value.name;
                if (value.uri) {
                    attrName = ns.requirePrefix(value.uri, value.prefix) + ":" + value.local;
                }
                element.attributes[attrName] = value.value;
            }
        }
        top.children.push(element);
        stack.push(element);
    };

    parser.ontext = function(text) {
        const top = stack[stack.length-1];
        top.children.push(text);
    }
    parser.oncdata = function(cdata) {
        const top = stack[stack.length-1];
        top.children.push(cdata);
    }
    parser.onclosetag = function (tagName) {
        stack.pop();
    }

    parser.write(xml);
    parser.end();

    return root;
}

export class XmlElements {
    constructor(public elements:XmlElement[]) { }

    /** Very basic query syntax, just element names separated by '/', eg. "foo/bar/baz".  Element names can be '*' */
    select(selectors:string) {
        let elements = this.elements;
        for(const selector of selectors.split('/')) {
            let nextElements:XmlElement[] = [];
            for(const element of elements) {
                for(const child of element.children) {
                    if (typeof(child) === 'object' && (selector === '*' || child.name === selector)) {
                        nextElements.push(child);
                    }
                }
            }
            elements = nextElements;
        }
        return new XmlElements(elements);
    }

    /** Get the first element to match the selector, or null if there aren't any.  Not optimised, but could be */
    selectFirst(selectors:string) {
        return this.select(selectors).elements[0] ?? null;
    }

    text() {
        return this.elements.map(el => el.text()).join("");
    }
}
