/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { XgenAttribute, XgenDataModel, XgenEntity, XgenRelationship } from './xgenParser';
import { XmlElement } from './Xml'
import { RuleLanguageSettings } from 'ia-public/Project'
import { NCSet, StringUtil, Lookup, NCMap } from './Util';
import { getRuleLanguage } from 'ia-public/RuleLanguage';

export interface MigrationSettings {
    /** List of entities that are collapsed into their parent during migration */
    collapseEntities:string[];

    /** regex that matches a rule document name, and either provides a that matches a pattern will be renamed.  First matching pattern will apply. */
    ruleDocumentFilter:{
        [pattern:string]:boolean
    };

    /** Renames attributes (and relationships) based on their name */
    attributeRename:{
        [pattern:string]:string
    }

    /** Legends in Excel documents are migrated, but in conclusions they don't save much and get renamed if they are also present in earlier documents, so these are not normally included.
     * But they can be included if desired.
     */
    keepConclusionLegends?:boolean;

    /** Language settings to use for the migration */
    language:RuleLanguageSettings;
}

/** Create one of these for each project being migrated */
export class MigrationContext {
    constructor(
        public settings:MigrationSettings
    ) {}

    public language = getRuleLanguage(this.settings.language.language);
    public migrationLanguage = migrationLanguages[this.settings.language.language];
    public formats = this.settings.language.formats;

    public definedLegends = new NCMap<string>();

    public intermediates = new NCSet();

    createRelationshipConditionIntermediate(rel:XgenRelationship) {
        const defaultName = this.migrationLanguage.relationshipConditionTemplate.replace("?", this.migrateAttributeText(rel.text));
        return this.makeUniqueIntermediateName(defaultName);
    }

    /** 'unique' is a bit of a misnomer.  The field name might still clash with other fields, but it won't clash with other intermediates created during migration */
    makeUniqueIntermediateName(baseName:string) {
        let idx = 1, name = baseName;
        while(!this.intermediates.add(name)) {
            name = baseName + " " + (++idx);
        }
        return name;
    }

    private attributeRenamePatterns:[RegExp,string][] = Object.entries(this.settings.attributeRename).map(entry => [new RegExp(entry[0], "gi"), entry[1]]);
    public migrateAttributeText(attrText:string) {
        for(const pattern of this.attributeRenamePatterns) {
            attrText = attrText.replace(pattern[0], pattern[1]);
        }

        return this.makeFieldName(attrText);
    }

    /** Create a valid field name (or partial field name) out of some source text that may contain invalid characters. */
    public makeFieldName(sourceText:string) {
        let fieldText = sourceText;
        if (/[0-9]/.test(fieldText.charAt(0))) {
            fieldText = "_" + fieldText;
        }

        // Parenthesis don't really have a neat equivalent in nextgen:
        fieldText = fieldText.replace(/\(/g, '_').replace(/\)/g, '_');

        // Quotes aren't allowed in a field name
        fieldText = fieldText.replace(/"/g, '_');

        // These aren't really valid attribute text, but may appear in event rules
        fieldText = fieldText.replace(/:/g, '_');

        function replaceOperators(operator:string) {
            let pos=fieldText.indexOf(operator);
            while(pos >= 0) {
                if (!StringUtil.isLetterOrDigit(fieldText.charAt(pos-1)) || !StringUtil.isLetterOrDigit(fieldText.charAt(pos+1))) {
                    // Would be treated as an operator, so we have to replace it
                    fieldText = fieldText.substring(0,pos) + '_' + fieldText.substring(pos+1);
                }
                pos = fieldText.indexOf(operator, pos+1);
            }
        }

        replaceOperators('-');
        replaceOperators('/');

        return fieldText;
    }

    public createNumberLiteral(value:number) {
        const fmt = this.settings.language.formats;

        // It is hacky to use toString() and rebuild the string like this, but toString() seems to guarantee
        // the round-trip of decimals in a way that is hard to achieve ourselves. IEEE floating point is hard, man!
        const str = (value).toString();

        // Number format: digits ['.' digits] [ ('e' | 'E') ('+' | '-' | '') digits ]
        let pos = 0, isNegative = false;
        if (str.charAt(pos) === '-') {
            pos++;
            isNegative = true;
        }

        let digits = "";
        while(isDigit(str.charAt(pos))) {
            digits += str.charAt(pos++);
        }
        let decimalPos = digits.length;
        if (str.charAt(pos) === '.') {
            pos++;
            while(isDigit(str.charAt(pos))) {
                digits += str.charAt(pos++);
            }
        }
        if (str.charAt(pos) === 'e' || str.charAt(pos) === 'E') {
            pos++;
            let negativeExponent = false;
            if (str.charAt(pos) === '-') {
                negativeExponent = true;
                pos++;
            } else if (str.charAt(pos) === '+') {
                // Optional, positive exponent is assumed
                pos++;
            }

            let exponentStr = "";
            while(isDigit(str.charAt(pos))) {
                exponentStr += str.charAt(pos++);
            }
            const exponent = parseInt(exponentStr);

            // Shift the decimal place based on the exponent, which may involve some zero padding
            decimalPos += (negativeExponent ? -exponent : exponent);
            if (decimalPos <= 0) {
                // Add preceding zeros
                digits = "0".repeat(-decimalPos+1) + digits;
                decimalPos = 1;
            } else if (decimalPos > digits.length) {
                digits += "0".repeat(decimalPos - digits.length);
            }
        }

        let ret = (isNegative ? "-" : "");

        // Emit digits before the decimal with thousands separators
        let lastPos = 0, thousPos = decimalPos - ((decimalPos-1)/3|0)*3;
        while(thousPos < decimalPos) {
            ret += digits.substring(lastPos, thousPos) + fmt.thousandsSeparator;
            lastPos = thousPos;
            thousPos += 3;
        }
        ret += digits.substring(lastPos, decimalPos);
        if (decimalPos < digits.length) {
            ret += fmt.decimalSeparator + digits.substring(decimalPos);
        }

        return ret;
    }

    public createStringLiteral(value:string) {
        // String literals may have quotes, which actually takes some finesse to handle elegantly
        let lastPos=0, bits:string[] = [];
        for(;;) {
            const quotePos = value.indexOf('"', lastPos);
            const endPos = (quotePos >= 0) ? quotePos : value.length;
            if (endPos > lastPos) {
                bits.push('"' + value.substring(lastPos, endPos) + '"');
            }
            if (quotePos < 0) {
                // All done
                return bits.join(" + ");
            }
            bits.push(this.functionCall("Quote", []));
            lastPos = quotePos+1;
        }
    }

    public createDateLiteral(date:string) {
        const [year,month,day] = date.split('-');
        const shortMonth = (month.charAt(0) === '0') ? month.substring(1) : month;
        const shortDay = (day.charAt(0) === '0') ? day.substring(1) : day;

        switch(this.formats.dateFormat) {
            case 'd/m/yyyy':
                return `${shortDay}/${shortMonth}/${year}`;
            case 'dd/mm/yyyy':
                return `${day}/${month}/${year}`;
            case 'm/d/yyyy':
                return `${shortMonth}/${shortDay}/${year}`;
            case 'yyyy-mm-dd':
                return `${year}-${month}-${day}`;
            default:
                throw "unsupported date format"
        }
    }

    public functionName(englishName:string) {
        const fnTranslations = this.language.functions;
        return fnTranslations ? fnTranslations[englishName] : englishName;
    }

    public functionCall(englishName:string, args:string[]) {
        return this.functionName(englishName) + "(" + args.join(this.formats.argumentSeparator +  " ") + ")";
    }
}

/** Normally an attribute reference just becomes the migrated field name, but this allows that behaviour to be overidden.
 * Used to retain references to legends (which show up as regular attribute references when compiled).
 */
export type AttributeReferenceHandler = (attr:XgenAttribute, range:string) => string;

export class DocumentMigrationContext {
    collapsedEntities = new Set<XgenEntity>();
    collapsedRelationships = new Set<XgenRelationship>();

    public constructor(
        public context:MigrationContext,
        public model:XgenDataModel,
        /** Callback to construct an intermediate when the expression is too complicated for the converter to do inline */
        private createIntermediateRule:(entity:XgenEntity, intermediateName:string, valueXml:XmlElement, conditionXml:XmlElement) => void
    ) {
        for(const entityName of context.settings.collapseEntities) {
            const entity = model.entities.find(entity => StringUtil.equalsNC(entity.name, entityName));
            if (entity) {
                this.collapsedEntities.add(entity);
                this.collapsedRelationships.add(entity.containmentRel);
            }
        }
    }

    public getEntityObjectName(entity:XgenEntity) {
        if (this.collapsedEntities.has(entity)) {
            const parent = entity.containmentRel.source;
            return this.getEntityObjectName(parent);
        }
        if (entity.containmentRel) {
            const name = this.context.migrateAttributeText(entity.containmentRel.text);
            const parentName = this.getEntityObjectName(entity.containmentRel.source);
            return (parentName ? (parentName + ":") : "") + name;
        } else {
            return undefined;
        }
    }

    public convertExpression(exprXml:XmlElement, activeAttributeHandler:AttributeReferenceHandler = null) {
        const language = this.context.language;

        // parentPrecedence determines whether this expression needs to be parenthesised to avoid precedence problems
        const convert = (exprXml:XmlElement, parentPrecedence:number):string => {
            if (exprXml.name === "attribute") {
                const attr = this.model.attributesById[exprXml.attributes["attr-id"]];
                if (activeAttributeHandler && exprXml.attributes["line-offset"]) {
                    // Could be a reference to a legend that we want to keep
                    return this.context.migrateAttributeText(activeAttributeHandler(attr, exprXml.attributes["line-offset"]));
                }
                return this.context.migrateAttributeText(attr.text);
            } else if (exprXml.name === "true-value") {
                return language.keywords.true;
            } else if (exprXml.name === "false-value") {
                return language.keywords.false;
            } else if (exprXml.name === "string-value") {
                return this.context.createStringLiteral(exprXml.text());
            } else if (exprXml.name === "number-value") {
                const v = parseFloat(exprXml.text());
                return this.context.createNumberLiteral(v);
            } else if (exprXml.name === "date-value") {
                return this.context.createDateLiteral(exprXml.text());
            } else if (exprXml.name === "relationship") {
                const rel = this.model.relationshipsById[exprXml.attributes["relationship-id"]];
                if (!rel) {
                    throw "Missing relationship " + exprXml.attributes["relationship-id"];
                }
                return this.context.migrateAttributeText(rel.text);
        
            } else if (exprXml.name === "for") {
                // need to do some magic with this
                const scope = exprXml.childElement(0);
                if (scope.name === "scope-ref") {
                    // Scope references can either be:
                    // - Implicit, where a rule references an attribute that belongs to an earlier scope.
                    // - Explicit, where a previously defined scope is explicitly named in the expression.
                    //
                    // An implicit scope reference can be simply stripped out, since the nextgen compiler will re-generate it during compilation.
                    // Explicit references rely on named scopes (eg. "for all people (other person)"), a feature that next-gen rules don't have yet.
                    //
                    // We can sort of guess when a scope is implicit, by the fact that its name looks autogenerated (eg. ent2_1)
                    const scopeId = scope.attributes["id"];
                    if (scopeId === "global0" || /^ent[0-9]+_[0-9]+$/.test(scopeId)) {
                        // Looks like an autogenerated scope id, which means the compiler would have generated the scope-ref
                        // to resolve an implicit reference to the parent scope.  The same implicit reference should be valid
                        // in web rules, so we can ignore the scope reference.  Probably.  :-)
                        return convert(exprXml.childElement(1), parentPrecedence);
                    }
                } else if (scope.name === "relationship") {
                    // If this is a reverse containment relationship then we're just looking up the chain, and that
                    // works without any kind of qualifier.
                    const rel = this.model.relationshipsById[scope.attributes["relationship-id"]];
                    if (rel.source.containmentRel === rel.reverse) {
                        return convert(exprXml.childElement(1), parentPrecedence);
                    }
                }
                logDocumentMigrationWarning("Unsupported for() expression found");
                return "For(" + convert(exprXml.childElement(0), 0) + ", " + convert(exprXml.childElement(1), 0) + ")";
        
            } else if (exprXml.name === "unknown" || exprXml.name === "uncertain") {
                return convert(exprXml.childElement(0), 0) + " = " + language.keywords.null;
        
            } else if (exprXml.name === "certain" || exprXml.name === "known") {
                return convert(exprXml.childElement(0), 0) + " <> " + language.keywords.null;
        
            } else if (exprXml.name === "current-date") {
                // This is a data item created in all new flow-schemes, so it's reasonable to guess this value will be available
                return "the current date";
        
            } else if (exprXml.name === "current-time") {
                logDocumentMigrationWarning("Unsupported CurrentDateTime() expression found");
                return "CurrentDateTime()";
        
            } else if (exprXml.name === "uncertain-value") {
                return language.keywords.null;
        
            } else if (opConversions[exprXml.name]) {
                const op = opConversions[exprXml.name] as [number, string];
                const convertedArgs = exprXml.childElements().map((expr,idx) => {
                    // When parentPrecedence is equal to the child's precedence, it adds parenthesis.
                    // This ensures that eg. minus(x,plus(y,z)) becomes "x-(y+z)", even though minus and plus have the same predence.
                    // However we tell a white lie to the first child that the precedence is fractionally lower, 
                    // which ensures that eg. plus(minus(x,y),z) becomes "x-y+z" rather than "(x-y)+z" which has superfluous parenthesis.
                    const opPrecedence = idx === 0 ? op[0]-0.01 : op[0];
                    return convert(expr, opPrecedence);
                });
                return parenthesise(convertedArgs.join(" " + op[1] + " "), op[0], parentPrecedence);
    
            } else if (exprXml.name === "negate") {
                const convertedArg = convert(exprXml.childElement(0), negationPrecedence-0.01); // -0.01, see above why this 'white lie' is told
                return parenthesise("-" + convertedArg, negationPrecedence, parentPrecedence);

            } else if (functionConversions[exprXml.name]) {
                // Eliminate references to collapsed relationships that are (probably) just lifting a value up into the parent context.
                // eg. "InstanceValueIf(the customer, the customer's name, the customer's name is known)" becomes just "the customer's name"
                if ((exprXml.name === "instance-value-if" || exprXml.name ===  "exists" || exprXml.name === "for-all") && exprXml.childElement(0).name === "relationship") {
                    const rel = this.model.relationshipsById[exprXml.childElement(0).attributes["relationship-id"]];
                    if (this.collapsedRelationships.has(rel)) {
                        // Probably just extracting a value out of a singleton relationship - so bypass the function
                        // and just convert the value.
                        // It may not be correct, but that relationship won't exist after migration anyway.
                        return convert(exprXml.childElement(1), parentPrecedence);
                    }
                }

                const functionName = functionConversions[exprXml.name];

                if (exprXml.name === "exists" || exprXml.name === "for-all") {
                    const relXml = exprXml.childElement(0);
                    const conditionXml = exprXml.childElement(1);
                    if (relXml.name === "relationship" && (conditionXml.name === "and" || conditionXml.name === "or")) {
                        // This is a multiline condition, which is unsupported so we'll need to define an intermediate.
                        // Note the converted condition may not work if it depends on the scope in which this expression is operating.
                        const rel = this.model.relationshipsById[relXml.attributes["relationship-id"]];
                        const intermediateName = this.context.createRelationshipConditionIntermediate(rel);
                        this.createIntermediateRule(rel.target, intermediateName, new XmlElement("true-value"), conditionXml);
                        return this.context.functionCall(functionName, [convert(relXml, 0), intermediateName]);
                    }
                }

                const convertedArgs = exprXml.childElements().map(expr => convert(expr, 0));
                return this.context.functionCall(functionName, convertedArgs);

            } else if (exprXml.name === "conclude") {
                // Nested conclusion
                const entity = this.model.entitiesById[exprXml.attributes["entity-id"]];
                const attr = this.model.attributesById[exprXml.attributes["attr-id"]];
                const valueXml = exprXml.select("value/*").elements[0];
                const conditionXml = exprXml.select("condition/*").elements[0];
                const fieldName = this.context.migrateAttributeText(attr.text);
                this.createIntermediateRule(entity, fieldName, valueXml, conditionXml);
                return fieldName;

            } else if (exprXml.name === "and" || exprXml.name === "or") {
                // A multiline condition that would normally be handled higher up.
                // eg. an ExistsScope or condition of an "is member of" could contain this, but it should have been
                // caught already.  So this is hopefully just a backstop.
                logDocumentMigrationWarning(`Multiline condition cannot be converted`);
                return "unsupported multiline condition";

            } else {
                logDocumentMigrationWarning(`"${exprXml.name}" not supported`);

                // default conversion
                const children = exprXml.select("*").elements.map(childXml => convert(childXml, 0));
                return exprXml.name + "(" + children.join(", ") + ")";
            }
        }

        return convert(exprXml, 0);
    }
}

function parenthesise(expr:string, innerPrecedence:number, parentPrecedence:number) {
    const needsParen = innerPrecedence <= parentPrecedence; // eg. '+' inside a '*' must be parenthesised
    return needsParen ? "(" + expr + ")" : expr;
}

function isDigit(c:string) {
    return /[0-9]/.test(c)
}

export function logDocumentMigrationWarning(text:string) {
    console.error("Warning: " + text);
}

interface MigrationLanguage {
    /** Strings to output */
    legends:string;

    valueConditionTemplate:string;
    relationshipConditionTemplate:string;

    negationTemplate:string;

    /** Expected values when parsing documents */
    genericCondition:string;
    genericConclusion:string;
}

export const migrationLanguages:Lookup<MigrationLanguage> = {
    'en':{
        legends:"Legends",
        genericCondition:"Condition",
        genericConclusion:"Conclusion",
        valueConditionTemplate:"the value for ? should be used",
        relationshipConditionTemplate:"the condition for ?",
        negationTemplate:"it is false that ?"
    },
    'fr':{
        legends:"Légendes",
        genericCondition:"condition",
        genericConclusion:"conclusion",
        valueConditionTemplate:"la valeur doit être utilisée pour ?",
        relationshipConditionTemplate:"la condition pour ?",
        negationTemplate:"c'est faux que ?"
    },
    'es':{
        legends:"Leyendas",
        genericCondition:"condición",
        genericConclusion:"conclusión",
        valueConditionTemplate:"se debe usar el valor para ?",
        relationshipConditionTemplate:"la condición para ?",
        negationTemplate:"es falso que ?"
    }
}

/** Parse a numerical range expressed as N-M */
export function parseRange(rangeText:string) {
    const match = /^([0-9]+)\-([0-9]+)$/.exec(rangeText);
    if (!match) throw "bad range";
    return {start:parseInt(match[1]), end:parseInt(match[2])};
}


const opConversions = {
    "equals": [1, "="],
    "not-equals": [1, "<>"],
    "less-than-equals": [1, "<="],
    "greater-than-equals": [1, ">="],
    "less-than": [1, "<"],
    "greater-than": [1, ">"],
    "plus": [2, "+"],
    "minus": [2, "-"],
    "multiply": [3, "*"],
    "divide": [3, "/"]
}
const negationPrecedence = 10;  // high precedence 

/** XML names of functions and their named webrule equivalents */
const functionConversions = {
    "abs":"Abs",
    "ex":"Ex",
    "ln":"Ln",
    "log":"Log",
    "round": "Round",
    "trunc":"Trunc",
    "sqrt":"Sqrt",
    "xy":"Xy",
    "modulo":"Remainder",
    "maximum":"Maximum",
    "minimum":"Minimum",
    // "value-of": no equivalent
    "date":"Date",
    //"datetime" - datetime datatype is not supported
    //"time-of-day" - timeofday datatype is not supported
    "number":"Number",
    "add-days":"AddDays",
    "next-day-of-the-week":"NextDayOfTheWeek",
    "add-weeks":"AddWeeks",
    "add-months":"AddMonths",
    "add-years":"AddYears",
    // "current-date" - handled elsewhere, converted to a field reference that is assumed to exist
    "weekday-count":"WeekdayCount",
    "year-difference":"YearDifference",
    //"year-end": no equivalent - could convert to Date(ExtractYear)
    //"year-start": no equivalent
    "extract-year":"ExtractYear",
    "extract-month":"ExtractMonth",
    "extract-day":"ExtractDay",
    //"next-date" - no equivalent, could replace NextDate(dt,d,m) with temp = MakeDate(ExtractYear(dt),m,d), result = If(temp > dt, temp, AddYears(temp,1)) though it does not handle leap years
    "day-difference":"DayDifference",
    //"day-difference-inclusive" - no equivalent, could be converted to DayDifference(x,y)+1 because yes it really is just that.
    // "day-difference-exclusive" - no equivalent, could be converted to DayDifference(x,y)-1.
    "week-difference":"WeekDifference",
    "month-difference":"MonthDifference",
    "make-date":"Date",

    // Functions that require the datetime or time-of-day datatype:
    // "current-time"
    // "concatenate-datetime"
    // "extract-date"
    // "extract-time-of-day"
    // "extract-hour"
    // "extract-second"
    // "extract-minute"
    // "hour-difference"
    // "minute-difference"
    // "second-difference"
    // "second-difference-inclusive"
    // "second-difference-exclusive"
    // "add-hours"
    // "add-minutes"
    // "add-seconds"

    "contains":"Contains",
    "ends-with":"EndsWith",
    //"is-number" - no direct equivalent, could be replaced with 'Number(V) <> null' though null doesn't propagate like uncertain would
    "length":"Length",
    "starts-with":"StartsWith",
    "substring":"Substring",
    "upper":"Upper",
    "lower":"Lower",
    "text-find":"Find",
    "text":"Text",
    "acos":"Acos",
    "asin":"Asin",
    "atan":"Atan",
    "cos":"Cos",
    "sin":"Sin",
    "tan":"Tan",
    "instance-count":"Count",               // "Count" is just a newer name, the old name "InstanceCount" is deprecated
    "instance-count-if":"InstanceCountIf",  // better to use the deprecated name in this case, as Count(Filter(rel, condition)) does something slightly different
    "instance-maximum":"Maximum",
    "instance-minimum":"Minimum",
    "instance-minimum-if":"InstanceMinimumIf",
    "instance-maximum-if":"InstanceMaximumIf",
    "instance-sum":"Sum",
    "instance-sum-if":"InstanceSumIf",
    "instance-value-if":"InstanceValueIf",

    // Temporal functions, not supported at all
    //"temporal-after":
    //"temporal-on-or-after":
    //"temporal-before":
    //"temporal-on-or-before":
    //"temporal-on":
    //"temporal-years-since":
    //"temporal-months-since":
    //"temporal-weeks-since":
    //"temporal-days-since":
    //"interval-daily-sum":
    //"interval-daily-sum-if":
    //"interval-weighted-average":
    //"interval-weighted-average-if":
    //"interval-maximum":
    //"interval-maximum-if":
    //"interval-minimum":
    //"interval-minimum-if":
    //"interval-count-distinct":
    //"interval-count-distinct-if":
    //"value-at":
    //"when-next":
    //"when-last":
    //"temporal-consecutive-days":
    //"temporal-always-days":
    //"temporal-sometimes-days":
    //"temporal-is-weekday":
    //"temporal-once-per-month":
    //"temporal-from-start-date":
    //"temporal-from-end-date":
    //"temporal-from-range":
    //"interval-sometimes":
    //"interval-always":
    //"interval-consecutive-days":
    //"interval-at-least-days":
    //"earliest":
    //"latest":
    
    "exists":"Exists",
    "for-all":"ForAll",

    // "for" - often this function is inserted by the compiler for implicit scope references, so it has special handling
    // "exists-in" - no equivalent (this is "is member of")
   //  "instance-equals" could be converted to X=Y, but this is very rare outside of aliases which aren't supported
    // "instance-not-equals"  could be converted to X<>Y, but this is very rare outside of aliases which aren't supported

    "not":"Not",

    // These are all handled as special cases that convert to null comparisons
    //"known"
    //"unknown"
    //"uncertain"
    //"certain"

    "new-line":"NewLine",
    "quote":"Quote",

    "default":"Default",
    "default-with-unknown":"Default",

    "if": "If",

    // "current-locale" - no equivalent function
}
