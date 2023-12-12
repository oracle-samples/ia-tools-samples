/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import decompress from 'decompress-unzip';
import { parseXml, XmlElement, XmlNamespaces } from './Xml'
import { parseCellRange, toCellRef } from './ExcelUtil'

interface Lookup<T> {
    [name:string]:T;
}

export interface ExcelDocument {
    sheets:ExcelSheet[];
}

export interface ExcelSheet {
    name:string;

    /** All cells by their ref, eg. "A1".  Merged cells are accessible via all of overlapped cell positions */
    cells:Lookup<ExcelCell>;

    /** This won't duplicate merged cells */
    cellList:ExcelCell[];
}

export interface ExcelCell {
    position:string;
    value:string|number|boolean;
    style:string;
    colSpan:number;
    rowSpan:number;
};

export async function readExcelDocument(xlsxBuffer:Buffer):Promise<ExcelDocument> {
    const ns = new XmlNamespaces();
    ns.add("w", "http://schemas.openxmlformats.org/spreadsheetml/2006/main");
    ns.add("rPkg", "http://schemas.openxmlformats.org/package/2006/relationships");
    ns.add("rDoc", "http://schemas.openxmlformats.org/officeDocument/2006/relationships");

    const xlsxFiles = await decompress()(xlsxBuffer);

    let workbookXml:XmlElement, stylesXml:XmlElement, sharedStringsXml:XmlElement, workbookRelsXml:XmlElement;
    let sheetsXml:{[name:string]:XmlElement} = {};
    let sheetRelsXml:{[name:string]:XmlElement} = {};

    xlsxFiles.forEach(file => {
        if (file.path === "xl/workbook.xml") {
            workbookXml = parseXml(file.data.toString(), ns);
        } else if (file.path === "xl/styles.xml") {
            stylesXml = parseXml(file.data.toString(), ns);
        } else if (file.path === "xl/sharedStrings.xml") {
            // Apparently if the workbook doesn't contain anything, it is possible that sharedStrings.xml is an empty string
            const xml = file.data.toString();
            sharedStringsXml = xml ? parseXml(xml, ns) : null;
        } else if (file.path === "xl/_rels/workbook.xml.rels") {
            workbookRelsXml = parseXml(file.data.toString(), ns);
        } else if (file.path.startsWith("xl/worksheets/sheet") && file.path.endsWith(".xml")) {
            const sheetName = file.path;
            sheetsXml[sheetName] = parseXml(file.data.toString(), ns);
        } else if (file.path.startsWith("xl/worksheets/_rels/sheet") && file.path.endsWith(".xml.rels")) {
            // Removing the "_rels" and ".rels" gives us the worksheet name that this corresponds to
            const sheetName = "xl/worksheets/" + file.path.substring("xl/worksheets/_rels/".length, file.path.length-5);
            sheetRelsXml[sheetName] = parseXml(file.data.toString(), ns);
        }
    });

    if (!workbookXml) {
        throw "invalid Excel workbook";
    }

    // Parse out relationship table for workbooks - this contains the mapping of relationship ids to worksheet files
    const workbookRelationshipDict:Lookup<string> = {};
    for(const rel of workbookRelsXml.select("rPkg:Relationships/rPkg:Relationship").elements) {
        const relId = rel.attributes["Id"];
        const target = rel.attributes["Target"];
        workbookRelationshipDict[relId] = target;
    }

    // Parse workbooks - this contains the mapping of worksheet names to relationship ids
    const worksheetPathToName:Lookup<string> = {};
    for(const shel of workbookXml.select("w:workbook/w:sheets/w:sheet").elements) {
        const sheetName = shel.attributes["name"];
        const relId = shel.attributes["rDoc:id"];
        const sheetPath = workbookRelationshipDict[relId];
        worksheetPathToName["xl/" + sheetPath] = sheetName;
    }

    const sharedStrings:string[] = [];
    if (sharedStringsXml) {
        for (const el of sharedStringsXml.select("w:sst/w:si").elements) {
            let text = "";
            for(const childEl of el.childElements()) {
                if (childEl.name === "w:t") {
                    text += childEl.text();
                } else if (childEl.name === "w:r") {
                    text += childEl.select("w:t").text();
                }
            }

            // Convert newlines, CRLF to LF.  Unsure if this is necessary but OPM does it so we do too.
            text = text.replace(/\r/g, "");

            sharedStrings.push(text);
        }
    }

    const stylesCellStyleXfs:XmlElement[] = stylesXml.select("w:styleSheet/w:cellStyleXfs/w:xf").elements;

    const styleNames:string[] = [], styleFills:string[] = [];

    for(const el of stylesXml.select("w:styleSheet/w:cellStyles/w:cellStyle").elements) {
        const xfId = parseInt(el.attributes["xfId"]), styleName = el.attributes["name"];
        styleNames[xfId] = styleName;
        styleFills[xfId] = stylesCellStyleXfs[xfId].attributes["fillId"];
    }

    interface CellStyle {
        styleName:string;
        fillIdx:number;
        numberFormatIdx:number;
    }
    const cellStyles:CellStyle[] = [];
    for(const el of stylesXml.select("w:styleSheet/w:cellXfs/w:xf").elements) {
        const formatId = (el.attributes["applyNumberFormat"] === "1") ? parseInt(el.attributes["numFmtId"]) : 0;
        const styleIdx = parseInt(el.attributes["xfId"]);
        const fillIdx = parseInt(el.attributes["fillId"]);
        cellStyles.push({
            styleName:styleNames[styleIdx],
            fillIdx:fillIdx,
            numberFormatIdx:formatId
        })
    }

    const customFormats:string[] = [];
    for(const el of stylesXml.select("w:styleSheet/w:numFmts/w:numFmt").elements) {
        const formatId = parseInt(el.attributes["numFmtId"]);
        const formatCode = el.attributes["formatCode"];
        customFormats[formatId] = formatCode;
    }

    function parseExcelValue(v:string, formatId:number, t:string):string|number {

        enum ExcelDateType {
            None,
            Time,
            Date,
            DateTime
        }

        let type = ExcelDateType.None;

        if (customFormats[formatId]) {
            const formatString = customFormats[formatId];

            // these checks aren't entirely satisfactory, but excel custom format strings appear
            // to be crazier than a bag of cats. eg the code 'm' may be minutes or months, depending on whether
            // the 'h' tag appears before it.
            let hasTimeElements = false, hasDateElements = false;
            let inQuotes = false;
            for (let i = 0; i < formatString.length; i++) {
                const c = formatString.charAt(i);
                if (c == '"') {
                    inQuotes = !inQuotes;
                } else if (!inQuotes) {
                    if (c === 'h') {
                        hasTimeElements = true;
                    } else if (c === 'y') {
                        hasDateElements = true;
                    }
                }
            }

            if (hasDateElements && hasTimeElements) {
                type = ExcelDateType.DateTime;
            } else if (hasDateElements) {
                type = ExcelDateType.Date;
            } else if (hasTimeElements) {
                type = ExcelDateType.Time;
            }
        }

        const num2 = (n:number) =>  n > 9 ? (""+n) : ("0"+n);

        function formatTime(value:number) {
            const tv = value - Math.floor(value);
            const totalSecs = Math.round(tv * 24 * 60 * 60);
            const h = (totalSecs / (60 * 60)) | 0;
            const m = ((totalSecs - h * 60 * 60) / 60) | 0;
            const s = totalSecs - h * 60 * 60 - m * 60;
            return num2(h) + ":" + num2(m) + ":" + num2(s);
        }
        function formatDate(value:number) {
            const days = Math.floor(value);

            // Excel dates are exciting as they are 1-based at 1/1/1900
            // Also to retain compatibility with a Lotus 1-2-3 bug
            // that treated 1900 as a leap year, there is also
            // effectively a discontinuity at 28/2/1900
            const lotusAdjustment = (days>59 ? -1 : 0);
            const d = new Date(Date.UTC(1900,0,days + lotusAdjustment));
            return d.getUTCFullYear() + "-" + num2(d.getUTCMonth()+1) + num2(d.getUTCDate());
        }

        // these constants are pulled from the Office Open XML specification

        if (type == ExcelDateType.Time || formatId >= 18 && formatId <= 21 || formatId >= 32 && formatId <= 35 || formatId >= 45 && formatId <= 47) {
            const value = parseFloat(v);
            return formatTime(value);

        } else if (type == ExcelDateType.DateTime || formatId == 22) {
            const value = parseFloat(v);
            return formatDate(value) + " " + formatTime(value);

        } else if (type == ExcelDateType.Date || formatId >= 14 && formatId <= 17 || formatId >= 27 && formatId <= 31 || formatId == 36
            || formatId >= 50 && formatId <= 58) {
            const dt = parseFloat(v);
            return formatDate(dt);
        } else if (!t || t == "n") {
            const value = parseFloat(v);

            // Possible weird compatibility thing here.  In the original code format 49 used the machine's current culture settings, and
            // anything else used the project format, but the cell is still considered by the compiler to contain text.
            // For migration purposes we just identify these cells as number cells instead, then the migrator can decide what to do.
            // This seems mostly good except we have lost any memory of what precision Excel was using to format those numbers.
            return value;
        } else {
            return v;
        }

    }

    function parseWorksheet(doc:XmlElement, name:string, relDoc:XmlElement) {

        const sheet:ExcelSheet = {
            name:name,
            cells:{},
            cellList:[]
        };

        for (const row of doc.select("w:worksheet/w:sheetData/w:row").elements) {
            for (const cellXml of row.select("w:c").elements) {
                const position = cellXml.attributes["r"];

                let cellStyle:CellStyle = null;
                let value:string|number|boolean = null;

                if (cellXml.attributes["s"]) {
                    const cellStyleidx = parseInt(cellXml.attributes["s"]);
                    cellStyle = cellStyles[cellStyleidx];
                }

                const cellValueType = cellXml.attributes["t"];
                if (cellValueType === "s") {
                    const v = cellXml.selectFirst("w:v");
                    if (v) {
                        const vcontent = v.text();
                        if (vcontent) {
                            value = sharedStrings[parseInt(vcontent)];
                        }
                    }

                } else if (cellValueType === "b") {
                    // boolean value in cell
                    const intValue = cellXml.selectFirst("w:v");
                    value = (intValue && parseInt(intValue.text()) !== 0) ? true : false;

                } else {
                    const vEl = cellXml.selectFirst("w:v");
                    if (vEl) {
                        const formatId = cellStyle ? cellStyle.numberFormatIdx : 0;
                        value = parseExcelValue(vEl.text(), formatId, cellXml.attributes["t"]);
                    } else {
                        value = "";
                    }
                }

                const styleName = cellStyle?.styleName ?? "";
                const cell:ExcelCell = {position, value, style:styleName, colSpan:1, rowSpan:1};
                sheet.cells[position] = cell;
            }
        }

        for (const mergeEl of doc.select("w:worksheet/w:mergeCells/w:mergeCell").elements) {
            const mergeRef = mergeEl.attributes["ref"];
            const mergeRange = parseCellRange(mergeRef);
            const baseRef = toCellRef(mergeRange.start.col, mergeRange.start.row);
            const baseCell = sheet.cells[baseRef];

            baseCell.colSpan = mergeRange.end.col - mergeRange.start.col + 1;
            baseCell.rowSpan = mergeRange.end.row - mergeRange.start.row + 1;

            for(let col=mergeRange.start.col; col<=mergeRange.end.col; col++) {
                for(let row=mergeRange.start.row; row<=mergeRange.end.row; row++) {
                    sheet.cells[toCellRef(col,row)] = baseCell;
                }
            }
        }

        // Now that cells have been merged, we can build a list of unique cells
        for(const ref in sheet.cells) {
            const cell = sheet.cells[ref];
            if (cell.position === ref) { // skips merged cells
                sheet.cellList.push(cell);
            }
        }

        return sheet;
    }

    const sheets:ExcelSheet[] = [];    
    for(const name in sheetsXml) {
        sheets.push(parseWorksheet(sheetsXml[name], worksheetPathToName[name], sheetRelsXml[name]));
    }

    return { sheets }
}

