/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import decompress from 'decompress-unzip';
import { RuleComment, RuleDocument, RuleBlock, RuleLine, RuleTable } from 'ia-public/RuleDocument'
import { parseXgenDataModel, XgenAttribute, XgenEntity } from './XgenParser';
import { parseXml, XmlElement, XmlNamespaces } from './Xml'
import { StringUtil, addToSet, hasOwnProperty } from './Util';
import { MigrationContext, DocumentMigrationContext, logDocumentMigrationWarning } from './MigratorCommon';

const ruleLevelStyles = {
    "OPM - conclusion":0,
    "OPM - level 1":1,
    "OPM - level 2":2,
    "OPM - level 3":3,
    "OPM - level 4":4,
    "OPM - level 5":5,
    "OPM - level 6":6
}

const commentLevelsStyles = {
    "Comment - conclusion":0,
    "Comment - Level 1":1,
    "Comment - Level 2":2,
    "Comment - Level 3":3,
    "Comment - Level 4":4,
    "Comment - Level 5":5,
    "Comment - Level 6":6
}

interface WordContainer {
    baseParaIdx:number;
    content:WordPara[];
}

// Easy lookup of document text by para idx
interface WordPara {
    text:string;
    style:string;
}


export async function migrateWordRuleDocument(docxBuffer:Buffer, xgen:XmlElement, context:MigrationContext):Promise<RuleDocument> {
    const language = context.language;
    const migrationLanguage = context.migrationLanguage;

    const ifFunction = context.functionName("If");
    const notFunction = context.functionName("Not");
    const filterFunction = context.functionName("Filter");
    const comma = context.formats.argumentSeparator;
    const nullVal = language.keywords.null;

    // Very linear structure.  All lines (paragraphs) of text are added to a big flat array, even those inside a table cell.
    // This mirrors the structure the OPM compiler uses (which also mirrors Microsoft Word's addressing of paragraphs in the document).
    // To allow the migrator to find all the other content inside the same table cell, a parallel array indicates which container
    // (ie. table cell or the main document) a paragraph belongs to.

    // All the lines of text (paragraphs) in the entire document.  Indexing must match the OPM compiler, so at idx=0 there is a null.
    const docLines:WordPara[] = [null];

    // The content of the document, ignoring table content
    const mainDoc:WordContainer = { baseParaIdx:0, content:[null] }

    // For all paras, the container they are inside of
    const docContainers:WordContainer[] = [null];

    // Uses the outline levels indicated in the styles.xml to determine what heading level to use for everything
    const headingStyles:{[name:string]:number} = {};

    const docxFiles = await decompress()(docxBuffer);

    const ns = new XmlNamespaces();
    ns.add("d", "http://schemas.openxmlformats.org/wordprocessingml/2006/main");
 
    let docXml:XmlElement, docStylesXml:XmlElement;
    docxFiles.forEach(file => {
        if (file.path === "word/document.xml") {
            docXml = parseXml(file.data.toString(), ns);
        } else if (file.path === "word/styles.xml") {
            docStylesXml = parseXml(file.data.toString(), ns);
        }
    });

    const styleIdToName = {};
    for(const styleEl of docStylesXml.select("d:styles/d:style").elements) {
        const styleId = styleEl.attributes["d:styleId"];
        const styleNameEl = styleEl.selectFirst("d:name");
        if (styleNameEl) {
            const styleName = styleNameEl.attributes["d:val"];
            if (styleName) {
                styleIdToName[styleId] = styleName;

                if (StringUtil.containsNC(styleName, "Heading 1")) {
                    headingStyles[styleName] = 1;
                } else if (StringUtil.containsNC(styleName, "Heading 2")) {
                    headingStyles[styleName] = 2;
                } else if (StringUtil.containsNC(styleName, "Heading 3")) {
                    headingStyles[styleName] = 3;
                } else if (StringUtil.containsNC(styleName, "Heading 4")) {
                    headingStyles[styleName] = 4;
                } else if (StringUtil.containsNC(styleName, "Heading 5")) {
                    headingStyles[styleName] = 5;
                } else if (StringUtil.containsNC(styleName, "Heading 6")) {
                    headingStyles[styleName] = 6;
                } else if (StringUtil.containsNC(styleName, "Heading 7")) {
                    headingStyles[styleName] = 7;
                } else if (StringUtil.containsNC(styleName, "Heading")) {
                    headingStyles[styleName] = 1;
                }
            }
        }
    }

    function readParaText(el:XmlElement) {
        let paraText = "";
        for(const childEl of el.childElements()) {
            if (childEl.name === "d:r") {
                for(const runEl of childEl.childElements()) {
                    if (runEl.name === "d:t") {
                        paraText += runEl.text();
                    } else if (runEl.name === "d:tab") {
                        paraText += '\t';
                    } else if (runEl.name === "d:br") {
                        paraText += '\v';
                    }
                }
            } else if (childEl.name === "d:ins" || childEl.name === "d:hyperlink" || childEl.name === "d:smartTag" || childEl.name === "d:fldSimple") {
                // Stuff that wraps other content.
                // ins=Insertion from a tracked change.
                // fldSimple is a simple field, which contains runs of text 
                paraText += readParaText(childEl);
            }
        }
        return paraText;
    }

    let deferredInsertedTextBuilder = null;
    function parsePara(paraEl:XmlElement) {
        let style = "normal";
        const styleId = paraEl.selectFirst("d:pPr/d:pStyle")?.attributes?.["d:val"];
        if (styleId && styleIdToName[styleId]) {
            style = styleIdToName[styleId];
        }

        const paraText = readParaText(paraEl);

        if (paraEl.attributes["d:rsidDel"]) {
            // This paragraph has no end-of-line (EOL) because it has been deleted (with change tracking turned on, so the content is still there).
            // So retain this text until a non-deleted EOL is found.
            deferredInsertedTextBuilder = (deferredInsertedTextBuilder ?? "") + paraText;
            return null;
        }

        const fullParaText:string = (deferredInsertedTextBuilder ?? "") + paraText;
        deferredInsertedTextBuilder = null;
        return { style, text:fullParaText };
    }

    const addPara = (container:WordContainer, para:WordPara) => {
        docLines.push(para);
        container.content.push(para);
        if (para) {
            docContainers.push(container);
        } else {
            // Adding a blank line
            docContainers.push(null);
        }
        if (container !== mainDoc) {
            mainDoc.content.push(null);
        }
        paraIndex++;
    }

    let paraIndex = 1;
    for(const el of docXml.select("d:document/d:body/*").elements) {
        if (el.name === "d:p") {
            const p = parsePara(el);
            addPara(mainDoc, p);
        } else if (el.name === "d:tbl") {
            for (const elrow of el.select("d:tr").elements) {
                for(const elcell of elrow.select("d:tc").elements) {
                    const cellContent:WordContainer = { baseParaIdx:paraIndex, content:[] };

                    for(const elcp of elcell.select("d:p").elements) {
                        const p = parsePara(elcp);
                        addPara(cellContent, p);
                    }
                }
                // there's an uncounted line at the end of every table
                addPara(mainDoc, null);
            }
        } else if (el.name == "d:sdt") {
            const contentEl = el.selectFirst("d:sdtContent");
            if (contentEl) {
                for (const pEl of contentEl.select("d:p").elements) {
                    // in-level structures are not processed by OPM, just increase the paragraph index
                    const tocPara = parsePara(pEl);
                    addPara(mainDoc, tocPara);
                }
            }
        } else if (el.name === "d:sectPr") {
            // Previous section properties (for change tracking).  Ignored.

        } else {
            // We should be cautious if any unknown content types are found, as we really want paragraph
            // indices to match up with how how OPM counts paragraphs because it affects how non-rule paragraphs
            // (eg. headings) are emitted.
            // If this warning does occur, it would be a good idea to check how OPM treats that content and match it.
            logDocumentMigrationWarning(`Unsupported content "${el.name}" in document`);
        }
    }

    if (docLines.length !== paraIndex || docContainers.length !== paraIndex || mainDoc.content.length !== paraIndex) {
        throw "line mismatch";
    }

    const convertedDoc:RuleDocument = [];

    let nonRuleContent = mainDoc;
    let nonRuleParaIdx = 0;
    let deferredBlocks:RuleBlock[] = [];

    function requireRuleBlock(entity:XgenEntity):RuleBlock {
        const lastItem = convertedDoc[convertedDoc.length-1];
        const requiredObjectName = docContext.getEntityObjectName(entity);

        if (lastItem && lastItem.type === 'rule-block' && lastItem.object === requiredObjectName) {
            return lastItem;
        }

        const block:RuleBlock = {type:'rule-block', lines:[], object:requiredObjectName};
        convertedDoc.push(block);
        return block;
    }

    // Converted styles
    const convertedHeadingStyles:RuleComment["style"][] = ['heading1','heading2','heading3','heading4'];

    /** Within the current container, emit any non-rule content up to the specific paragraph index */
    function emitNonRuleContent(targetBlock:RuleBlock, endParaIdx:number) {
        // Inside tables, we don't actually know the para index until we encounter an expression that has the "source-offset"
        // attribute on it.  So when the non-rule content is null, hunt for the content.
        if (nonRuleContent == null) {
            nonRuleContent = docContainers[endParaIdx];
            if (nonRuleContent == null) {
                return;
            }
            nonRuleParaIdx = 0;
        }

        // We want to handle headings and so on
        for(; nonRuleParaIdx < endParaIdx; nonRuleParaIdx++) {
            const p = nonRuleContent.content[nonRuleParaIdx - nonRuleContent.baseParaIdx];
            if (!p || hasOwnProperty(ruleLevelStyles, p.style)) {
                // This is rule content, which is already emitted by looking at compiled rules
                continue;
            }

            if (!targetBlock) {
                const headingLevel = headingStyles[p.style];
                if (headingLevel !== undefined) {
                    convertedDoc.push({
                        style:convertedHeadingStyles[Math.min(headingLevel-1, convertedHeadingStyles.length-1)],
                        text:p.text
                    })
                } else {
                    // Emit as normal styled text
                    convertedDoc.push({
                        style:'normal',
                        text:p.text
                    })
                }
            } else {
                const commentLevel = commentLevelsStyles[p.style] as number;
                if (commentLevel !== undefined) {
                    targetBlock.lines.push({type:'inactive', level:commentLevel, text:p.text})
                } else if (StringUtil.isAllWhitespace(p.text)) {
                    // If it's blank anyway, it'll look better without the comment outline
                    targetBlock.lines.push({type:'active', level:0, text:p.text})
                } else {
                    targetBlock.lines.push({type:'comment', level:0, text:p.text});
                }
            }
        }
    }

    const model = parseXgenDataModel(xgen);

    // Converts a condition XML into rule content.
    // Optionally attempts to include the trailingOp (ie. 'and' or 'or') in the condition, and returns true if it was able to.
    // Otherwise returns false and the caller may need to do it
    function convertCondition(targetBlock:RuleBlock, level:number, exprXml:XmlElement, hasSiblings:boolean, trailingOp:string):boolean {
        if (exprXml.attributes["source-offset"]) {
            const paraIdx = parseInt(exprXml.attributes["source-offset"]);
            emitNonRuleContent(targetBlock, paraIdx);
        }

        if (exprXml.name === "or" || exprXml.name === "and") {
            const isOr = (exprXml.name === "or");
            let children = exprXml.select("*").elements;

            // Recognise the pattern: "x is unknown or x is uncertain".  In this case we don't need 2 tests.
            // We could also recognise "x is known and x is certain" but this doesn't seem to be as common.
            if (isOr) {
                const nullChecks = new Set();
                children = children.filter(child => {
                    if (child.name === "unknown" || child.name === "uncertain") {
                        const attrEl = child.childElement(0);
                        if (attrEl.name === "attribute" && !addToSet(nullChecks, attrEl.attributes["attr-id"])) {
                            return false;
                        }
                    }
                    return true;
                })
            }

            const opName = isOr ? language.keywords.or : language.keywords.and;
            if (children.length === 1) {
                // With only 1 child (which is likely given the above optimisation for null checking), the 'and/or' can be skipped entirely.
                return convertCondition(targetBlock, level, children[0], hasSiblings, trailingOp);
            } else {
                let childLevel = level;
                if (hasSiblings) {
                    targetBlock.lines.push({level:level, text:isOr ? language.keywords.any : language.keywords.all});
                    childLevel++;
                }
                children.forEach((childXml,childIdx) => {
                    const needsOp = (childIdx < children.length-1);
                    const emittedOp = convertCondition(targetBlock, childLevel, childXml, true, needsOp ? opName : null);
                    if (!emittedOp && needsOp) {
                        // The condition line didn't manage to emit an operator, so we'll do it on a separate line
                        targetBlock.lines.push({level:childLevel, text:opName});
                    }
                });
                return false;
            }
        } else {
            const text = docContext.convertExpression(exprXml) + (trailingOp ? (" " + trailingOp) : "");
            targetBlock.lines.push({level, text});
            return true;
        }
    }

    const docContext = new DocumentMigrationContext(context, model, (entity, fieldName, valueXml, conditionXml) => {
        const targetBlock:RuleBlock = {type:'rule-block', lines:[], object:docContext.getEntityObjectName(entity)};
        deferredBlocks.push(targetBlock);
        writeConclude(targetBlock, fieldName, valueXml, conditionXml);
    });

    function writeConclude(targetBlock:RuleBlock, fieldName:string, valueXml:XmlElement, conditionXml:XmlElement) {
        if (conditionXml) {
            // Then it's a boolean conclusion.  Check for a negative conclusion
            if (valueXml.name === "true-value") {
                targetBlock.lines.push({level:0, text:fieldName + " " + language.keywords.if});
                convertCondition(targetBlock, 1, conditionXml, false, null);
            } else if (valueXml.name === "false-value") {
                // A negatively concluded boolean, eg. "the person is not eligible if ..."
                // Rewrite as "<attr> is not true if ..." and "<attr> = Not(<attr> is not true)"
                const negativeFieldName = migrationLanguage.negationTemplate.replace("?", fieldName);
                targetBlock.lines.push({level:0, text:negativeFieldName + " " + language.keywords.if});
                convertCondition(targetBlock, 1, conditionXml, false, null);
                targetBlock.lines.push({level:0, text:`${fieldName} = ${notFunction}(${negativeFieldName})`});
            } else {
                logDocumentMigrationWarning(`Value rule with a condition, will be null when condition is false: "${fieldName}"`);

                // the value for <conclusion> should be used if <condition>
                const conditionFieldName = migrationLanguage.valueConditionTemplate.replace("?", fieldName);
                targetBlock.lines.push({level:0, text:conditionFieldName + " " + language.keywords.if});
                convertCondition(targetBlock, 1, conditionXml, false, null);

                // <conclusion> = if(<value should be used>, <value>, null)
                const valueExpr = docContext.convertExpression(valueXml);
                const valueRule = `${fieldName} = ${ifFunction}(${conditionFieldName}${comma} ${valueExpr}${comma} ${nullVal})`
                targetBlock.lines.push({level:0, text:valueRule});
            }
        } else {
            // Regular value rule
            targetBlock.lines.push({level:0, text:fieldName + " = " + docContext.convertExpression(valueXml)});
        }        
    }

    function convertConclude(concludeXml:XmlElement) {
        const entity = model.entitiesById[concludeXml.attributes["entity-id"]];
        const attr = model.attributesById[concludeXml.attributes["attr-id"]];
        const valueXml = concludeXml.select("value/*").elements[0];
        const conditionXml = concludeXml.select("condition/*").elements[0];

        const targetBlock = requireRuleBlock(entity);
        writeConclude(targetBlock, context.migrateAttributeText(attr.text), valueXml, conditionXml);
    }

    function convertConcludeInstance(concludeXml:XmlElement) {
        const entity = model.entitiesById[concludeXml.attributes["source"]];
        const conclusionRel = model.relationshipsById[concludeXml.attributes["relationship-id"]];
        const targetBlock = requireRuleBlock(entity);

        if (conclusionRel.target.containmentRel !== conclusionRel) {
            // OPM allowed inferring via the non-containment relationship, but webrules doesn't have any equivalent.
            logDocumentMigrationWarning(`Non-containment relationship "${conclusionRel.text}" is used to infer entity instances.  This will become a primary record list after migration which will change its behaviour.`);
        }

        const idAttr = conclusionRel.target.identifyingAttr;

        targetBlock.lines.push({level:0, text:context.migrateAttributeText(conclusionRel.text) + " = ..."})
        const table:RuleTable = { type:'table', columns:[ { type:'condition' }, { type:'conclusion', text:context.migrateAttributeText(idAttr.text) } ], rows:[] };

        const conditionXml = concludeXml.selectFirst("condition/*");
        const identityXml = concludeXml.selectFirst("identity/*");

        let tableCondition:RuleLine[] | string = "";

        if (conditionXml) {
            // We need to construct a temporary block into which the condition is inserted, then extract the content out again
            const tempBlock:RuleBlock = {type:'rule-block', lines:[]};
            convertCondition(tempBlock, 0, conditionXml, false, null);
            tableCondition = tempBlock.lines as RuleLine[];
        }

        table.rows.push([tableCondition, docContext.convertExpression(identityXml)]);

        targetBlock.lines.push(table);
    }

    function convertTableConclude(tableXml:XmlElement) {
        const entity = model.entitiesById[tableXml.attributes["entity-id"]];
        const targetBlock = requireRuleBlock(entity);

        const condXml = tableXml.select("condition-col").elements[0];
        const concXml = tableXml.select("conclusion-col").elements[0];
        let conclusionAttr:XgenAttribute;

        if (concXml.attributes["relationship-id"])  {
            // Concluding an entity in a table.
            const conclusionRel = model.relationshipsById[concXml.attributes["relationship-id"]];

            // In v12, the identifying attribute was implicitly set by an inferred entity rule. In webrules this is an explicit column:
            conclusionAttr = conclusionRel.target.identifyingAttr;

            if (conclusionRel.target.containmentRel !== conclusionRel) {
                // OPM allowed inferring via the non-containment relationship, but webrules doesn't have any equivalent.
                logDocumentMigrationWarning(`Non-containment relationship "${conclusionRel.text}" is used to infer entity instances.  This will become a primary record list after migration which will change its behaviour.`);
            }

            targetBlock.lines.push({level:0, text:context.migrateAttributeText(conclusionRel.text) + " = ..."})

        } else {
            // Regular attribute concluded in a Word rule
            conclusionAttr = model.attributesById[concXml.attributes["attr-id"]];
        }

        const table:RuleTable = { type:'table', columns:[ { type:'condition' }, { type:'conclusion', text:context.migrateAttributeText(conclusionAttr.text) } ], rows:[] };

        const conditionRows = condXml.select("rows/*").elements.map(row => {
            if (row.name === "empty") {
                return "";
            } else if (row.name === "condition") {
                // Save and restore the position of non-rule content that lives outside of the table cell

                const saveContent = nonRuleContent, saveContentParaIdx = nonRuleParaIdx;
                nonRuleContent = null;  // Resets the position any non-rule content to the start of the current container.

                const targetBlock:RuleBlock = {type:'rule-block', lines:[]};
                convertCondition(targetBlock, 0, row.firstChildElement(), false, null);
                const ret = targetBlock.lines as RuleLine[];

                nonRuleContent = saveContent;
                nonRuleParaIdx = saveContentParaIdx;
                return ret;
            } else {
                throw "unknown condition row type"
            }
        })

        const conclusionRows = concXml.select("*").elements.map(row => {
            if (row.name === "value") {
                return docContext.convertExpression(row.firstChildElement());
            } else {
                throw "unknown conclusion row type"
            }
        })

        for(let i=0; i<conditionRows.length; i++) {
            table.rows.push([conditionRows[i], conclusionRows[i]]);
        }

        targetBlock.lines.push(table);
    }

    function convertEvent(eventXml:XmlElement) {
        const eventText = eventXml.attributes["action"];

        logDocumentMigrationWarning(`Event rule will be converted to a boolean rule: "${eventText}"`);

        const entity = model.entitiesById[eventXml.attributes["entity-id"]];
        const targetBlock = requireRuleBlock(entity);

        targetBlock.lines.push({level:0, text:context.migrateAttributeText(eventText) + " " + language.keywords.if});

        const conditionXml = eventXml.select("condition/*").elements[0];
        convertCondition(targetBlock, 1, conditionXml, false, null);
    }

    function convertConcludeRel(concludeRelXml:XmlElement) {
        const rel = model.relationshipsById[concludeRelXml.attributes["relationship-id"]];
        const allTargetsExpr = docContext.getEntityObjectName(rel.target);
        const conditionXml = concludeRelXml.select("condition/*").elements[0];

        if (conditionXml.name === "and" || conditionXml.name === "or") {
            // multiline condition which will require an intermediate:
            const conditionField = context.createRelationshipConditionIntermediate(rel);
            const block = requireRuleBlock(rel.source);
            block.lines.push({level:0,
                text:`${context.migrateAttributeText(rel.text)} = ${filterFunction}(${allTargetsExpr}${comma} ${conditionField})`
            });
            
            const conditionBlock = requireRuleBlock(rel.target);
            conditionBlock.lines.push({level:0, text:`${conditionField} ${language.keywords.if}`});
            convertCondition(conditionBlock, 1, conditionXml, false, null);

        } else {
            // Should be able to express this condition in a single line
            const conditionExpr = docContext.convertExpression(conditionXml);
            const block = requireRuleBlock(rel.source);
            block.lines.push({level:0,
                text:`${context.migrateAttributeText(rel.text)} = ${filterFunction}(${allTargetsExpr}${comma} ${conditionExpr})`
            });
        }
    }

    for(const ruleXml of xgen.select("root/rules/rule").elements) {
        const ruleParaIdx = parseInt(ruleXml.attributes["source-offset"]);
        emitNonRuleContent(null, ruleParaIdx);
        const actualRuleXml = ruleXml.select("rule-xml/*").elements[0];
        if (actualRuleXml.name === "table-conclude") {
            convertTableConclude(actualRuleXml);
        } else if (actualRuleXml.name === "conclude") {
            convertConclude(actualRuleXml);
        } else if (actualRuleXml.name === "conclude-instance") {
            convertConcludeInstance(actualRuleXml);
        } else if (actualRuleXml.name === "event") {
            convertEvent(actualRuleXml);
        } else if (actualRuleXml.name === "conclude-rel") {
            // condition for the relationship
            convertConcludeRel(actualRuleXml);
        } else {
            logDocumentMigrationWarning(`Unsupported rule type "${actualRuleXml.name}"`)

            const global = model.entitiesById['global'];
            const targetBlock = requireRuleBlock(global)
            targetBlock.lines.push({level:0, type:'comment', text:"unsupported rule type"});
        }

        if (deferredBlocks.length) {
            let lastBlock = convertedDoc[convertedDoc.length-1] as RuleBlock;
            if (lastBlock.type !== 'rule-block') {
                // The migrator shouldn't allow this to happen
                throw "Deferred rule content without rule block"
            }

            while(deferredBlocks.length) {
                const deferredBlock = deferredBlocks.splice(0,1)[0];
                if (lastBlock.object === deferredBlock.object) {
                    // Same object, so the content can be merged
                    lastBlock.lines.push(...deferredBlock.lines);
                } else {
                    convertedDoc.push(deferredBlock);
                    lastBlock = deferredBlock;
                }
            }
        }
    }

    // Emit any leftover comments
    emitNonRuleContent(null, mainDoc.content.length);

    return convertedDoc;
}
