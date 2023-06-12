/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IALabelControl } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { logger } from "../Application";
import { localize } from "../Localizer";
import sanitizeHtml from "sanitize-html";

export function labelFactory(item: IALabelControl) {

    // Check if the label-type control has a custom/non-default scheme ID, if so
    // and render it accordingly, otherwise fallback to a div for normal or unknown label types
    if (item.schemeId === "html") {
        return generateHTMLBlock(item);
    }

    const translatedContent = {__html: localize(item.htmlTranslationKey, item.translationParameters, true)};
    if (item.schemeId == "heading" && item.customPropertyNames.includes('header-level') && item.getCustomProperty('header-level')) {
        const headerLevel = item.getCustomProperty('header-level');
        const header = headerFactory(`size-${item.layoutWidth}`, headerLevel, translatedContent);
        if (header) {
            return header;
        }
    }

    // fall through to default rendering
    return <div class={`label size-${item.layoutWidth}`} dangerouslySetInnerHTML={translatedContent}></div>;
}

function headerFactory(className, headerLevel, translatedContent) {
    switch (headerLevel) {
        case 1:
            return <h1 class={className} dangerouslySetInnerHTML={translatedContent}></h1>;
        case 2:
            return <h2 class={className} dangerouslySetInnerHTML={translatedContent}></h2>;
        case 3:
            return <h3 class={className} dangerouslySetInnerHTML={translatedContent}></h3>;
        case 4:
            return <h4 class={className} dangerouslySetInnerHTML={translatedContent}></h4>;
        case 5:
            return <h5 class={className} dangerouslySetInnerHTML={translatedContent}></h5>;
        case 6:
            return <h6 class={className} dangerouslySetInnerHTML={translatedContent}></h6>;

        default:
            logger.error("Not a valid header level '" + headerLevel + "'");
            return null;
    }
}


/** The content of 'html' controls is treated as raw HTML but tags not in the defined allowlist are escaped for security.
 *  Substitution values (from other fields) are always escaped */
function generateHTMLBlock(item: IALabelControl) {

    const allowedTags = ["a", "abbr", "address", "article", "aside", "b", "bdi", "bdo", "blockquote",
        "br", "caption", "cite", "code", "col", "colgroup", "data", "dd", "dfn", "div", "dl", "dt", "em",
        "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr",
        "i", "kbd", "li", "main", "main", "mark", "nav", "ol", "p", "pre", "q", "rb", "rp", "rt", "rtc",
        "ruby", "s", "samp", "section", "small", "span", "strong", "sub", "sup", "table", "tbody", "td",
        "tfoot", "th", "thead", "time", "tr", "u", "ul", "var", "wbr"];

    // 'discard' could be used for disallowedTagsMode to remove the tag and its content, but 'escape' is better for debugging/easier
    // to identify accidental use of disallowed tags in the controls' text
    const disallowedTagsMode = "escape";
    const allowedAttributes = {
        a: ["href", "name", "target"],
        img: ["alt", "height", "loading", "src", "srcset", "title", "width"]
    };
    const selfClosing = [ "area", "base", "basefont", "br", "hr", "img", "input", "link", "meta" ];
    const allowedSchemes = [ "http", "https", "ftp", "mailto", "tel" ];
    const allowedSchemesByTag = {
        img: ["data"]
    };
    const allowedSchemesAppliedToAttributes = [ "cite", "href", "src" ];
    const allowProtocolRelative = true;
    const enforceHtmlBoundary = true; // true, even though the 'html' tag isn't in the allow-list above

    // even though text for an 'html' control is treated as raw HTML, any substitution should still be
    // escaped so users cannot alter the appearance of a page by entering HTML into fields which are used
    // in any label/'html' controls' substitutions; escaping the symbols <> occurs within the localize function
    const localizedText = localize(item.textTranslationKey, item.translationParameters, true);

    const safeHTML = sanitizeHtml(localizedText, {
        allowedTags: allowedTags,
        disallowedTagsMode: disallowedTagsMode,
        allowedAttributes: allowedAttributes,
        selfClosing: selfClosing,
        allowedSchemes: allowedSchemes,
        allowedSchemesByTag: allowedSchemesByTag,
        allowedSchemesAppliedToAttributes: allowedSchemesAppliedToAttributes,
        allowProtocolRelative: allowProtocolRelative,
        enforceHtmlBoundary: enforceHtmlBoundary
    });

    return <div class={`size-${item.layoutWidth}`} dangerouslySetInnerHTML={{ __html: safeHTML }}></div>
}