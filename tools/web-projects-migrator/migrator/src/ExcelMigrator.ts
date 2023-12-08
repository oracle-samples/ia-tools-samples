/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { parseXgenDataModel, XgenAttribute,     XgenEntity } from './XgenParser'
import { RuleDocument, RuleBlock, RuleTable } from 'ia-public/RuleDocument'
import { XmlElement } from './Xml'
import { readExcelDocument } from './ExcelDocument'
import { parseCellRange, parseCellRef, toCellRef } from './ExcelUtil'
import { logDocumentMigrationWarning, MigrationContext, DocumentMigrationContext, parseRange } from './MigratorCommon';
import { addToSet, Lookup, NCMap, StringUtil } from './Util'

const Styles = {
    ConclusionHeading:"OPM - Conclusion Heading",
    Conclusion:"OPM - Conclusion",

    ConditionHeading:"OPM - Condition Heading",
    Condition:"OPM - Condition",

    LegendAttribute:"OPM - Attribute Text",
    LegendType:"OPM - Attribute Type",
    LegendKey:"OPM - Legend Key"
}

interface StringEdit {
    start:number;
    end:number;
    replacement:string;
}

/** Easy way to apply batch edits to a string. Edits must be ordered and non-overlapping. */
function editString(original:string, changes:StringEdit[]) {
    let pos = 0, ret = "";

    for(const change of changes) {
        if (change.start < pos || change.end < change.start) throw "bad edit"
        ret += original.substring(pos, change.start) + change.replacement;
        pos = change.end;
    }

    ret += original.substring(pos);
    return ret;
}

export async function migrateExcelRuleDocument(xlsxBuffer:Buffer, xgen:XmlElement, context:MigrationContext) {
    const settings = context.settings;
    const migrationLanguage = context.migrationLanguage;

    const xlDoc = await readExcelDocument(xlsxBuffer);

    interface Legend {
        /* This may not be the original legend key, if it had to be renamed to avoid clashing with another legend */
        key:string;

        attribute:string;

        /** If true the legend was already defined in another document.  We won't need to redefine it. */
        isDefined:boolean;
    }

    const trimCellValue = (cellValue:string|number|boolean) => {
        return typeof(cellValue) === 'string' ? cellValue.trim() : (""+cellValue);
    }

    const declarationStyles = new Set([Styles.LegendAttribute, Styles.LegendType, Styles.LegendKey]);
    const declarationsFound:Lookup<boolean> = {};
    const legends:Lookup<Legend> = {};
    for(const sheet of xlDoc.sheets) {
        const isDecl = (col:number, row:number):boolean => {
            const cell = sheet.cells[toCellRef(col, row)];
            return (cell && declarationStyles.has(cell.style));
        }

        for(const cell of sheet.cellList) {
            if (declarationStyles.has(cell.style)) {
                const addr = parseCellRef(cell.position);
                let leftCol = addr.col;
                while(isDecl(leftCol-1, addr.row)) {
                    leftCol--;
                }
                const key = toCellRef(leftCol, addr.row);
                if (!declarationsFound[key]) {
                    declarationsFound[key] = true;

                    let rightCol = addr.col;
                    while(isDecl(rightCol+1, addr.row)) {
                        rightCol++;
                    }

                    // Index everything by its style
                    const decl = {};
                    for(let col=leftCol; col<=rightCol; col++) {
                        const cell = sheet.cells[toCellRef(col, addr.row)];
                        decl[cell.style] = trimCellValue(cell.value);
                    }

                    const legendKey = decl[Styles.LegendKey];
                    const legendAttribute = decl[Styles.LegendAttribute];
                    if (legendKey && legendAttribute) {
                        // Disambiguate with any previously defined legends
                        let idx = 1, migratedKey = legendKey;
                        for(;;) {
                            const existingLegend = context.definedLegends.get(migratedKey);
                            if (!existingLegend) {
                                // First time we've seen this legend
                                context.definedLegends.set(migratedKey, legendAttribute);
                                legends[StringUtil.nc(legendKey)] = { key:migratedKey, attribute:legendAttribute, isDefined:false };
                                break;
                            } else if (StringUtil.equalsNC(existingLegend, existingLegend)) {
                                // Re-use of an existing legend
                                legends[StringUtil.nc(legendKey)] = { key:migratedKey, attribute:legendAttribute, isDefined:true };
                                break;
                            }

                            migratedKey = legendKey + " " + (++idx);    // try again with a new name
                        }

                    }
                }
            }
        }
    }

    // Legends used in conclusions are defined next to the rule that proves them, so they don't need to be emitted later.
    const conclusionLegends:Set<Legend> = new Set<Legend>();
    const keepLegends = true;
    const keepConclusionLegends = settings.keepConclusionLegends ?? false;  // default to false because it really seems better without them

    const sheets = parseExcelXgen(xgen);
    const model = parseXgenDataModel(xgen);

    // Transposed rules (ie. where headings run down as rows instead of across as columns) are rare, and while the
    // xgen parser does understand them, the migrator doesn't, so they're stripped out 
    for(const sheet of sheets) {
        sheet.ruleBlocks = sheet.ruleBlocks.filter(block => {
            if (!block.isTransposed) return true;
            const blockRef = block.columns[0].heading.attributes["p"];
            logDocumentMigrationWarning(`Transposed rule has been skipped at ${blockRef}, "${sheet.name}"`);
            return false;
        });
    }

    const sheetsByName = new NCMap(sheets, sheet => sheet.name);

    const doc:RuleDocument = [];

    // Sheet names that are named as apply-sheet targets.
    const sheetsTargetedByApplySheet = new Set<XgenRuleSheet>();

    const docContext = new DocumentMigrationContext(context, model, () => { throw "intermediates shouldn't occur in Excel rule documents"});

    function isApplySheet(heading:XmlElement) {
        const text = heading.attributes["v"].trim();
        return StringUtil.equalsNC(text, "Apply Sheet");
    }
    function isGenericCondition(heading:XmlElement) {
        const text = heading.attributes["v"].trim();
        return StringUtil.equalsNC(text, migrationLanguage.genericCondition);
    }

    function getApplySheet(applySheetCell:XmlElement) {
        if (!applySheetCell) {
            return null;
        }
        const applySheetName = applySheetCell.attributes["v"].trim();
        const applySheetStyle = getStyle(applySheetCell);
        if (!applySheetName || applySheetStyle != Styles.Conclusion) {
            return null;
        }
        const refSheet = sheetsByName.get(applySheetName);
        if (!refSheet) throw `Apply Sheet ${applySheetName} can't be found!`; // shouldn't happen because otherwise OPM compiler would have failed
        return refSheet;
    }

    function applySheetFieldName(sheet:XgenRuleSheet, field:string) {
        return context.makeFieldName(sheet.name) + " " + field;
    }

    function getHeadingAttribute(heading:XmlElement):XgenAttribute {
        const attrRef = heading.select("ref").elements[0];
        if (attrRef && attrRef.attributes.k === "Attribute") {
            return model.attributesById[attrRef.attributes.v] ?? null;
        }
        return null;
    }

    function isTextHeading(heading:XmlElement) {
        const attr = getHeadingAttribute(heading);
        return attr && attr.type === "text";
    }

    function getStyle(cell:XmlElement) {
        // Boring cells may be absent from the xgen
        return cell ? cell.attributes["s"] : "";
    }

    function getRowSpan(cell:XmlElement) {
        // Boring cells may be absent from the xgen
        if (!cell) return 1;
        const rowSpanStr = cell.attributes["rowspan"];
        return rowSpanStr ? parseInt(rowSpanStr) : 1;
    }

    function requireRuleBlock(entity:XgenEntity):RuleBlock {
        const lastItem = doc[doc.length-1];
        const requiredObjectName = docContext.getEntityObjectName(entity);

        if (lastItem && lastItem.type === "rule-block" && lastItem.object === requiredObjectName) {
            return lastItem;
        }

        const newBlock:RuleBlock = {type:'rule-block', lines:[], object:requiredObjectName};
        doc.push(newBlock);
        return newBlock;
    }

    // So we can convert expressions correctly, create a lookup to find each compiled expression.
    const sheetExpressions:Lookup<XmlElement> = {};
    function addExpressions(xml:XmlElement) {
        const sourceOffset = xml.attributes["source-offset"];
        if (sourceOffset) {
            // Expressions can span multiple rows but the caching system below only requires the first spanned cell to be recorded
            sheetExpressions[sourceOffset] = xml;
        }
        for(const child of xml.children) {
            if (child instanceof XmlElement) {
                addExpressions(child);
            }
        }
    }
    addExpressions(xgen.selectFirst("root/rules"));

    function migrateCellText(cell:XmlElement) {
        // <ref> elements are based on the trimmed cell text so we have to trim the cell text here to find legends etc
        const cellText = cell.attributes["v"].trim();
        const edits:StringEdit[] = cell.childElements().map(refXml => {
            const r = parseRange(refXml.attributes["r"]);
            let refText:string = cellText.substring(r.start, r.end);

            const legend = legends[StringUtil.nc(refText)];
            if (legend) {
                refText = keepLegends ? legend.key : legend.attribute;
            }

            // NOTE: When a legend is not found, we could use the attribute's text but we deliberately don't do that.
            // This is because if the text is the negative form of a boolean attribute, we'd effectively be removing the
            // negation from a piece of logic in a silent fashion, which is a bad thing.
            return { start:r.start, end:r.end, replacement:context.migrateAttributeText(refText) };
        });
        return editString(cellText, edits);
    }

    for(const sheet of sheets) {
        for(const rule of sheet.ruleBlocks) {
            for(const col of rule.columns) {
                if (col.type === 'conclusion' && isApplySheet(col.heading)) {
                    for(const applySheetCell of col.cells) {
                        const applySheet = getApplySheet(applySheetCell);
                        if (applySheet) {
                            sheetsTargetedByApplySheet.add(applySheet);
                        }
                    }
                }
            }
        }
    }

    // Generate rules for every worksheet:
    for(const sheet of sheets) {
        const isThisSheetTargetOfApplySheet = sheetsTargetedByApplySheet.has(sheet);
        let sheetHasHeading = false;

        for(const rule of sheet.ruleBlocks) {
            // We don't bother with a heading for every sheet unless there's actual content to emit
            if (!sheetHasHeading) {
                doc.push({type:'comment', style:"heading1", text:sheet.name });
                sheetHasHeading = true;
            }

            interface ConvertedColumn {
                heading:string;
                isText:boolean;
                isEntityId:boolean;
                cells:string[];
            }

            /** Conclusion columns might belong to different entities, so columns are organised by entity. */
            interface TableEntity {
                /** The entity these conclusions belong to */
                entity:XgenEntity;

                /** If true, instances of the entity are actually being inferred */
                inferredEntity:boolean;

                /** Legends used (in conclusions) that belong to this entity, if we're emitting them */
                legends:Legend[];

                columns:ConvertedColumn[];
            }

            const convertedConditions:ConvertedColumn[] = [];
            const tableEntities:TableEntity[] = [];

            // Legends that are used as conclusions need to be defined slightly differently.  Make that happen here
            function createTableConclusion(conclusionCell:XmlElement) {
                // Try to find what object is being concluded
                const conclusionRef = conclusionCell.selectFirst("ref");
                if (!conclusionRef) {
                    // If we don't find any conclusion in the heading, it could be a generic conclusion (which we don't support).
                    return null;
                }
                if (conclusionRef.attributes["k"] === "Relationship") {
                    const rel = model.relationshipsById[conclusionRef.attributes["v"]];

                    if (rel.target.containmentRel !== rel) {
                        logDocumentMigrationWarning(`Non-containment relationship "${rel.text}" is used to infer entity instances.  This will become a primary record list after migration which will change its behaviour.`);
                    }

                    const idAttr = rel.target.identifyingAttr;
                    if (!idAttr) {
                        logDocumentMigrationWarning(`Inferred entity "${rel.target.name}" has no identifying attribute`);
                    }

                    // We'll have to assume this is a containment rel.  The column is actually inferring the identifying attribute, so fake that up:
                    const newColumn:ConvertedColumn = {
                        heading:context.migrateAttributeText(idAttr?.text ?? rel.target.name),
                        isText:idAttr?.type === "text",
                        isEntityId:true,
                        cells:[]
                    }
                    // We always want to create a new row for this one.
                    tableEntities.push({ entity:rel.target, inferredEntity:true, legends:[], columns:[newColumn] });

                    return newColumn;

                } else { // Attribute conclusion

                    // We always attach to the last matching entity in the table, because that prioritises any prior inferred entities
                    const attr = model.attributesById[conclusionRef.attributes["v"]];
                    let tableEntity:TableEntity = null;
                    for(let i=tableEntities.length-1; i>=0; i--) {
                        if (tableEntities[i].entity === attr.entity) {
                            tableEntity = tableEntities[i];
                            break;
                        }
                    }

                    if (!tableEntity) {
                        tableEntity = { entity:attr.entity, inferredEntity:false, legends:[], columns:[] };
                        tableEntities.push(tableEntity);
                    }

                    let newHeadingText:string;
                    if (isThisSheetTargetOfApplySheet) {
                        // No legend-handler here - this is an intermediate not the final value, so even if a legend is used, it's not being actually concluded
                        newHeadingText = applySheetFieldName(sheet, migrateCellText(conclusionCell));

                    } else {
                        // If the conclusion contains a legend, we can keep it, although this does complicate things.
                        // It requires the legend definition to be flipped (ie. ATTR=LEGEND instead of LEGEND=ATTR).
                        const r = parseRange(conclusionRef.attributes["r"]);
                        const refText:string = conclusionCell.attributes["v"].trim().substring(r.start, r.end);
                        let legend = legends[StringUtil.nc(refText)];
                        if (legend && keepConclusionLegends) {
                            if (legend.isDefined) {
                                // Conclusion legend will clash with a definition of the legend that happened in a previous document,
                                // We could go back and flip the earlier definition but that's too much fiddling.  Instead we just
                                // define a new name to (probably) avoid a clash.
                                logDocumentMigrationWarning(`Legend in an Excel conclusion conflicts with earlier document and will be renamed: "${legend.key}"`);
                                legend = { key:legend.key + " value", attribute:legend.attribute, isDefined:false };
                            }

                            conclusionLegends.add(legend);
                            tableEntity.legends.push(legend);
                            newHeadingText = context.migrateAttributeText(legend.key);

                        } else {
                            newHeadingText = context.migrateAttributeText(attr.text);
                        }
                    }

                    const newColumn:ConvertedColumn = {
                        heading:newHeadingText,
                        isText:attr.type === 'text',
                        isEntityId:false,
                        cells:[]
                    }

                    tableEntity.columns.push(newColumn);
                    return newColumn;
                }
            }

            const cellComparisonOps = {
                "equals":"=",
                "not-equals":"<>",
                "greater-than":">",
                "greater-than-equals":">=",
                "less-than":"<",
                "less-than-equals":"<="
            }

            let lastCellText:string = null;
            let lastCellColumn:number = null;
            let lastCellResult:string = null;
            function convertCellExpression(cell:XmlElement, headingIsText:boolean) {
                const cellAddr = parseCellRef(cell.attributes["p"]);

                // NOTE: This code assumes that cells are converted from top to bottom, one column at a time.  Read on for why.
                // We try to do all conversions using the compiled expression that was compiled from that cell.
                // However a pattern like 'FOO,comment,FOO' creates a single expression FOO with a span of 2, and the second
                // 'FOO' is not at the cell address we expect.  eg. "D3 rowspan 2" does not necessarily mean D3-D4.
                // Since the first cell will always be at the correct address, and cells are converted in order vertically,
                // there is a simple cache that just remembers that last cell content and the last column it appeared in,
                // and if we encounter the same content again in that column, we return the cached expression.
                if (lastCellColumn === cellAddr.col && lastCellText === cell.attributes["v"]) {
                    return lastCellResult;
                }

                const result = convertCellExpressionUncached(cell, headingIsText);
                lastCellColumn = cellAddr.col;
                lastCellText = cell.attributes["v"];
                lastCellResult = result;

                return result;
            }

            function convertCellExpressionUncached(cell:XmlElement, headingIsText:boolean) {
                // See if we can find the compiled equivalent of this expression:
                const cellRef = cell.attributes["p"];
                const cellText = cell.attributes["v"].trim();   // references are indexed into the trimmed text, so we must trim first
                const xmlExpr = sheetExpressions[sheet.name + "!" + cellRef];
                if (xmlExpr) {
                    if (xmlExpr.name === "uncertain") {
                        // Testing if the heading value is uncertain
                        return "= " + context.language.keywords.null;
                    }

                    const convertedExpr = docContext.convertExpression(xmlExpr.firstChildElement(), (attr:XgenAttribute, range:string) => {
                        if (keepLegends) {
                            // When an attribute is referenced, if the source text appears to reference a legend, then use the legend instead
                            const r = parseRange(range);
                            const text = cellText.substring(r.start, r.end);
                            const legend = legends[StringUtil.nc(text)];
                            if (legend) {
                                return legend.key;
                            }
                        }

                        // It's important to use attr.text here and not the source text, because a negation like "the person is not happy"
                        // is compiled to Not(attr) and we would end up with Not(the person is not happy) instead of Not(the person is happy).
                        return attr.text;
                    });

                    if (xmlExpr.name === "value" || xmlExpr.name === "condition" || xmlExpr.name === "equals") {
                        // A conclusion, a generic condition or a condition heading compared via equality.
                        // None of these require anything beyond the value itself
                        return convertedExpr;
                    } else if (cellComparisonOps[xmlExpr.name]) {
                        const op = cellComparisonOps[xmlExpr.name];
                        return op + " " + convertedExpr;
                    } else {
                        logDocumentMigrationWarning("Unknown cell expression " + xmlExpr.name);
                        return xmlExpr.name + "(" + convertedExpr + ")";
                    }
                }

                // Can't find the compiled expression for this cell, this is probably an apply-sheet condition.
                // The compiler pre-compiles apply-sheet rules and the conditions get pre-compiled into expressions
                // and leaves no way to identify the expressions for individual cells.
                // So we just do our best with the text content of the cell.  We still have the attribute and relationship
                // references inside each cell from the source dump, so we can at least recognise legends and
                // attribute/relationship text.

                if (!cellText) {
                    // This is an empty cell and has no effect.  Even for text cells (ie. it's not treated as a blank string)
                    return "";
                }

                // When the heading is text and is not surrounded by parenthesis, it is a string literal:
                if (headingIsText && !(cellText.startsWith("(") && cellText.endsWith(")"))) {
                    return context.createStringLiteral(cellText);
                }

                // Just rewrite legends and rewrite any rogue characters in attributes/relationships.
                logDocumentMigrationWarning(`No compiled expression for cell ${cellRef} on sheet '${sheet.name}', basic text migration only: '${cellText}'`);
                return migrateCellText(cell);
            }

            // all conditions converted first:
            for(const col of rule.columns.filter(col => col.type === 'condition')) {
                // Generic condition heading (blank, or just the word "condition" (language-dependent))
                const headingText = isGenericCondition(col.heading) ? "" : migrateCellText(col.heading);
                const convertedCondition:ConvertedColumn = { heading:headingText, isText:isTextHeading(col.heading), isEntityId:false, cells:[] };
                convertedConditions.push(convertedCondition);

                col.cells.forEach((cell) => {
                    const rowSpan = getRowSpan(cell);
                    const style = getStyle(cell);
                    if (style === Styles.Condition) {
                        convertedCondition.cells.push(convertCellExpression(cell, convertedCondition.isText));
                    } else {
                        //eg. this could be an 'else' condition
                        convertedCondition.cells.push("");
                    }
                    for(let i=1; i<rowSpan; i++) {
                        convertedCondition.cells.push(null);    // merged with previous
                    }
                });
            }

            for(const col of rule.columns.filter(col => col.type === 'conclusion')) {
                if (isApplySheet(col.heading)) {
                    // There's no "apply sheet" in web rules, so instead the "apply sheet" column becomes 
                    // a separate column for each attribute (relationships are unsupported) concluded on another sheet.

                    if (isThisSheetTargetOfApplySheet) {
                        throw "\"Apply Sheet\" cannot be used on itself";
                    }

                    const applySheets = col.cells.map(cell => getApplySheet(cell));

                    // Gather up all of the attributes that will be set in this rule.
                    // It's possible that an attribute might be referenced via a legend on one sheet, and
                    // using it's full name on another.  We just do whatever the first reference does.
                    interface ApplySheetAttribute {
                        nameOnSheet:string[];
                        column:ConvertedColumn
                    }
                    const applySheetAttributes:Lookup<ApplySheetAttribute> = {};    // keyed by attribute id
                    for(let applySheetIdx=0; applySheetIdx<applySheets.length; applySheetIdx++) {
                        const applySheet = applySheets[applySheetIdx];
                        if (!applySheet) {
                            // Blank apply sheet conclusion for this row
                            continue;
                        }
                        for(const ruleBlock of applySheet.ruleBlocks) {
                            for(const col of ruleBlock.columns.filter(col => col.type === 'conclusion')) {
                                const attr = getHeadingAttribute(col.heading);
                                if (!attr) {
                                    logDocumentMigrationWarning("Possible generic conclusion skipped inside an apply-sheet")
                                    continue;
                                }

                                let applySheetAttr:ApplySheetAttribute = applySheetAttributes[attr.id];
                                if (!applySheetAttr) {
                                    // We haven't seen this attribute before, so create its conclusion column
                                    const column = createTableConclusion(col.heading);
                                    if (!column) throw "column should be created";  // no conclusion in heading, which should already have been caught above
                                    applySheetAttr = { column:column, nameOnSheet:[] };
                                    applySheetAttributes[attr.id] = applySheetAttr;
                                }

                                const headingText = migrateCellText(col.heading);
                                applySheetAttr.nameOnSheet[applySheetIdx] = applySheetFieldName(applySheet, headingText);
                            }
                        }
                    }

                    // Conclude each apply sheet attribute to its value from one of the specific sheets
                    for(const applySheetAttrKey in applySheetAttributes) {
                        const applySheetAttr = applySheetAttributes[applySheetAttrKey];

                        col.cells.forEach((sheetCell,sheetIdx) => {
                            const rowSpan = getRowSpan(sheetCell);
                            const cellText = applySheetAttr.nameOnSheet[sheetIdx] ?? "";
                            applySheetAttr.column.cells.push(cellText);
                            for(let i=1; i<rowSpan; i++) {
                                applySheetAttr.column.cells.push(null);
                            }
                        });
                    }

                } else {
                    const column = createTableConclusion(col.heading);
                    if (!column) {
                        // Probably a generic conclusion which is unsupported.
                        const headingRef = col.heading.attributes["p"];
                        logDocumentMigrationWarning(`Unnamed conclusion heading skipped at ${headingRef}, "${sheet.name}"`)
                        continue;
                    }

                    col.cells.forEach(cell => {
                        const style = getStyle(cell);
                        const rowSpan = getRowSpan(cell);
                        if (style === Styles.Conclusion) {
                            column.cells.push(convertCellExpression(cell, column.isText));
                        } else {
                            column.cells.push("");
                        }
                        for(let i=1; i<rowSpan; i++) {
                            column.cells.push(null);    // merge with previous
                        }
                    });
                }
            }

            // For each of the entities that had conclusions, generate a new table for that entity
            for(const tableEntity of tableEntities) {
                if (tableEntity.legends.length) {
                    const legendBlock = requireRuleBlock(tableEntity.entity);
                    for(const legend of tableEntity.legends) {
                        legendBlock.lines.push({
                            level:0, text:context.migrateAttributeText(legend.attribute) + " = " + context.migrateAttributeText(legend.key)
                        })
                    }
                }

                const conclusionEntity = tableEntity.inferredEntity ? tableEntity.entity.containmentRel.source : tableEntity.entity;
                const ruleBlock = requireRuleBlock(conclusionEntity);

                if (tableEntity.inferredEntity) {
                    ruleBlock.lines.push({
                        level:0, text:context.migrateAttributeText(tableEntity.entity.containmentRel.text) + " = ..."
                    })
                }

                const table:RuleTable = {type:'table', columns:[], rows:[] };
                ruleBlock.lines.push(table);

                let rowCount = null;
                for(const condition of convertedConditions) {
                    table.columns.push({type:'condition', text:condition.heading});
                    if (rowCount === null) {
                        rowCount = condition.cells.length;
                    } else if (rowCount !== condition.cells.length) {
                        throw "row count mismatch"
                    }
                }

                for(const conclusion of tableEntity.columns) {
                    if (conclusion.isEntityId) {
                        table.columns.unshift({type:'identifier', text:conclusion.heading});
                        context.addInferredEntity(tableEntity.entity.name);
                    } else {
                        table.columns.push({type:'conclusion', text:conclusion.heading});
                    }

                    
                    if (rowCount === null) {
                        rowCount = conclusion.cells.length;
                    } else if (rowCount !== conclusion.cells.length) {
                        throw "row count mismatch"
                    }
                }

                if (rowCount == null) {
                    // Weird, but maybe it could happen
                    continue;
                }

                // It's polite to only warn about problems once per column.  Only one column can be an identity column so that's all good
                const columnsWithEmptyConclusions = new WeakSet<ConvertedColumn>();
                let repeatIdentityValues = false;
                const entityIdValues = new Set<string>();

                for(let i=0; i<rowCount; i++) {
                    const row = [];
                    table.rows.push(row);

                    for(const condition of convertedConditions) {
                        row.push(condition.cells[i]);
                    }

                    for(const conclusion of tableEntity.columns) {
                        if (conclusion.cells[i] !== null) { // ie. not a merged cell
                            if (!conclusion.cells[i]) {
                                // Blank celll
                                if (!columnsWithEmptyConclusions.has(conclusion)) {
                                    columnsWithEmptyConclusions.add(conclusion);
                                    logDocumentMigrationWarning(`Rule table for "${conclusion.heading}" on sheet "${sheet.name}" has some empty conclusions, which will behave differently when migrated`);
                                }   
                            } else {
                                if (conclusion.isEntityId && !addToSet(entityIdValues, conclusion.cells[i]) && !repeatIdentityValues) {
                                    repeatIdentityValues = true;
                                    logDocumentMigrationWarning(`Inferred entity "${conclusion.heading}" has repeated identity values (eg. ${conclusion.cells[i]}), which will behave differently when migrated`);
                                }
                            }
                        }
                        if (conclusion.isEntityId) {
                            row.unshift(conclusion.cells[i] !== null ? conclusion.cells[i].replace(/"/g, '') : null);
                        } else {
                            row.push(conclusion.cells[i]);
                        }
                    }
                }
            }
        }
    }

    // Now emit legends
    if (keepLegends) {
        const legendBlocks = new Map<XgenEntity,RuleBlock>();

        for(const legendKey in legends) {
            const legend = legends[legendKey];
            if (conclusionLegends && conclusionLegends.has(legend)) {
                // already emitted as a conclusion
                continue;
            }
            if (legend.isDefined) {
                // already emitted in a previous document
                continue;
            }

            const attr = model.attributesByText[StringUtil.nc(legend.attribute)];
            if (!attr) {
                logDocumentMigrationWarning(`Legend "${legendKey}" doesn't match any attribute`);
                continue;
            }

            let legendBlock:RuleBlock = legendBlocks.get(attr.entity);
            if (!legendBlock) {
                if (!legendBlocks.size) {
                    // First one, add a heading
                    doc.splice(0,0, { style:'heading1', text:migrationLanguage.legends });
                }

                legendBlock = {type:'rule-block', lines:[], object:docContext.getEntityObjectName(attr.entity)};
                legendBlocks.set(attr.entity, legendBlock);
                doc.splice(legendBlocks.size, 0, legendBlock);
            }

            legendBlock.lines.push({
                level:0,
                text:context.migrateAttributeText(legend.key) + " = " + context.migrateAttributeText(legend.attribute)
            })
        }
    }

    // We need at least some content (eg. somewhere for the cursor to begin)
    if (!doc.length) {
        doc.push({style:'normal', text:""});
    }

    return doc;
}

export interface XgenRuleSheet {
    name:string;
    ruleBlocks:XgenRuleBlock[];
}

export interface XgenRuleBlock {
    columns:XgenRuleColumn[];
    isTransposed:boolean;
}

export interface XgenRuleColumn {
    type:'conclusion' | 'condition';
    heading:XmlElement;

    /** Merged cells will not be repeated.  Therefore cells.length may not equal the table length.
     * Also it's possible to have missing cells, and they'll be null.
     */
    cells:XmlElement[];
}

function parseExcelXgen(xgen:XmlElement) {
    const sheetObjs:XgenRuleSheet[] = [];

    for(const sheet of xgen.select("root/source/sheet").elements) {
        const cells:{[ref:string]:XmlElement } = {};
        for(const cell of sheet.select("c").elements) {
            const colSpan = (cell.attributes.colspan) ? parseInt(cell.attributes.colspan) : 1;
            const rowSpan = (cell.attributes.rowspan) ? parseInt(cell.attributes.rowspan) : 1;
            if (colSpan === 1 && rowSpan === 1) {
                // simple case
                cells[cell.attributes.p] = cell;
            } else {
                // cell that spans a few columns/rows
                // crude approach here, in that cells are just repeated for every merged cell
                const baseRef = parseCellRef(cell.attributes.p);
                for(let i=0; i<colSpan; i++) {
                    for(let j=0; j<rowSpan; j++) {
                        const ref = toCellRef(baseRef.col+i, baseRef.row+j);
                        cells[ref] = cell;
                    }
                }
            }
        }

        const sheetObj:XgenRuleSheet = { name:sheet.attributes.name, ruleBlocks:[] };

        for(const ruleBlock of sheet.select("rule-block").elements) {
            const blockRange = parseCellRange(ruleBlock.attributes.range);
            const isTransposed = (ruleBlock.attributes["transposed"] === "true");

            const ruleBlockObj:XgenRuleBlock = { columns:[], isTransposed };

            const headingStartIdx = isTransposed ? blockRange.start.row : blockRange.start.col;
            const headingEndIdx = isTransposed ? blockRange.end.row : blockRange.end.col;
            const rowStartIdx = isTransposed ? blockRange.start.col : blockRange.start.row;
            const rowEndIdx = isTransposed ? blockRange.end.col : blockRange.end.row;
            const toBlockCellRef = (headingIdx:number, rowIdx:number) =>
                isTransposed ? toCellRef(rowIdx, headingIdx) : toCellRef(headingIdx, rowIdx);
            const rowSpanAttr = isTransposed ? "colspan" : "rowspan";

            for(let i=headingStartIdx; i<=headingEndIdx; i++) {
                const ref = toBlockCellRef(i, rowStartIdx);
                const headingCell = cells[ref];

                const colType = (headingCell.attributes.s === Styles.ConclusionHeading) ? 'conclusion' :
                                (headingCell.attributes.s === Styles.ConditionHeading) ? 'condition' : null;
                if (colType !== null) {
                    const columnObj:XgenRuleColumn = { type:colType, heading:headingCell, cells:[] }

                    for(let row=rowStartIdx+1; row<=rowEndIdx;) {
                        const cellRef = toBlockCellRef(i, row);
                        const sheetCell = cells[cellRef];
                        if (!sheetCell) {
                            console.error("oopsie!");
                        }
                        const rowSpan = sheetCell?.attributes[rowSpanAttr] ? parseInt(sheetCell.attributes[rowSpanAttr]) : 1;
                        columnObj.cells.push(sheetCell);
                        row += rowSpan;
                    } 
                    ruleBlockObj.columns.push(columnObj);
                }
            }

            sheetObj.ruleBlocks.push(ruleBlockObj);
        }

        sheetObjs.push(sheetObj);
    }

    return sheetObjs;
}
